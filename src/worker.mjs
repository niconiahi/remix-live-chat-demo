import isbot from "isbot";

isbot.exclude(["chrome-lighthouse"]);

/**
 * @typedef {{
 *  ORIGIN_URL: string;
 *  room: DurableObjectNamespace;
 * }} Env
 */

export default {
  /**
   * @param {Request} request
   * @param {Env} env
   * @param {ExecutionContext}context
   * @returns {Response}
   */
  async fetch(request, env, context) {
    context.passThroughOnException();

    const url = new URL(request.url);
    console.log("fetch ~ url", url);
    console.log(
      'fetch ~ isbot(request.headers.get("User-Agent"))',
      isbot(request.headers.get("User-Agent")),
    );

    console.log(
      'fetch ~ request.headers.get("Accept")',
      request.headers.get("Accept"),
    );
    console.log(
      'fetch ~ url.searchParams.has("_data")',
      url.searchParams.has("_data"),
    );
    console.log(
      `fetch ~ !(request.headers.get("Accept") || "").includes("text/html") &&
        !url.searchParams.has("_data")`,
      !(request.headers.get("Accept") || "").includes("text/html") &&
        !url.searchParams.has("_data"),
    );
    console.log("fetch ~ url.pathname", url.pathname);

    if (
      // is Remix
      isbot(request.headers.get("User-Agent")) ||
      (!(request.headers.get("Accept") || "").includes("text/html") &&
        !url.searchParams.has("_data"))
    ) {
      return await fetch(
        new URL(url.pathname + url.search, env.ORIGIN_URL),
        request,
      );
    }

    if (url.pathname.includes("ws")) {
      return handleWebsocketRequest(request, env);
    }

    return new Response("Not found", { status: 404 });
  },
};

/**
 * @param {Request} request
 * @param {Env} env
 */
function handleWebsocketRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  console.log("handleWebsocketRequest ~ path", path);

  switch (path) {
    case "/ws/room/get-id": {
      let id = env.room.newUniqueId();

      return new Response(id.toString(), {
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }
  }
}

export class Room {
  /**
   * @param {DurableObjectState} state
   * @param {Env} env
   */
  constructor(state, env) {
    // `controller.state` provides access to our durable state. It provides a simple KV
    // get()/put() interface.
    this.storage = state.storage;

    // `env` is our environment bindings (discussed earlier).
    this.env = env;

    // We will put the WebSocket objects for each client, along with some metadata, into
    // `sessions`.
    this.sessions = [];

    // We keep track of the last-seen message's timestamp just so that we can assign monotonically
    // increasing timestamps even if multiple messages arrive simultaneously (see below). There's
    // no need to store this to disk since we assume if the object is destroyed and recreated, much
    // more than a millisecond will have gone by.
    this.lastTimestamp = 0;
  }

  async fetch(request) {
    return await (request,
    async () => {
      let url = new URL(request.url);
      console.log("returnawaithandleErrors ~ url.pathname", url.pathname);

      switch (url.pathname) {
        case "/websocket": {
          // The request is to `/api/room/<name>/websocket`. A client is trying to establish a new
          // WebSocket session.
          if (request.headers.get("Upgrade") !== "websocket") {
            return new Response("expected websocket", { status: 400 });
          }

          // Get the client's IP address for use with the rate limiter.
          let ip = request.headers.get("CF-Connecting-IP");

          // To accept the WebSocket request, we create a WebSocketPair (which is like a socketpair,
          // i.e. two WebSockets that talk to each other), we return one end of the pair in the
          // response, and we operate on the other end. Note that this API is not part of the
          // Fetch API standard; unfortunately, the Fetch API / Service Workers specs do not define
          // any way to act as a WebSocket server today.
          const { 0: clientWebSocket, 1: serverWebSocket } =
            // eslint-disable-next-line no-undef
            new WebSocketPair();

          // We're going to take pair[1] as our end, and return pair[0] to the client.
          await this.handleSession(serverWebSocket, ip);

          // Now we return the other end of the pair to the client.
          return new Response(null, {
            status: 101,
            webSocket: clientWebSocket,
          });
        }

        default:
          return new Response("Not found", { status: 404 });
      }
    });
  }

  /**
   * @param {WebSocket} webSocket
   * @param {string} ip
   */
  async handleSession(webSocket, ip) {
    // Accept our end of the WebSocket. This tells the runtime that we'll be terminating the
    // WebSocket in JavaScript, not sending it elsewhere.
    webSocket.accept();

    // Create our session and add it to the sessions list.
    // We don't send any messages to the client until it has sent us the initial user info
    // message. Until then, we will queue messages in `session.blockedMessages`.
    // const session = {webSocket, blockedMessages: []};
    function getRandomString() {
      return (Math.random() + 1).toString(36).substring(7);
    }
    const name = getRandomString();
    let session = { webSocket, name };
    this.sessions.push(session);

    // Queue "join" messages for all online users, to populate the client's roster.
    // this.sessions.forEach(otherSession => {
    //   if (otherSession.name) {
    //     session.blockedMessages.push(JSON.stringify({joined: otherSession.name}));
    //   }
    // });

    // Load the last 100 messages from the chat history stored on disk, and send them to the
    // client.
    // const state = await this.state.list({reverse: true, limit: 100});
    // const backlog = [...state.values()].reverse();
    // backlog.forEach(value => {
    //   session.blockedMessages.push(value);
    // });

    // Set event handlers to receive messages.
    let receivedUserInfo = false;
    webSocket.addEventListener("message", async (message) => {
      try {
        if (session.quit) {
          // Whoops, when trying to send to this WebSocket in the past, it threw an exception and
          // we marked it broken. But somehow we got another message? I guess try sending a
          // close(), which might throw, in which case we'll try to send an error, which will also
          // throw, and whatever, at least we won't accept the message. (This probably can't
          // actually happen. This is defensive coding.)
          webSocket.close(1011, "WebSocket broken.");

          return;
        }

        // Check if the user is over their rate limit and reject the message if so.
        // if (!limiter.checkLimit()) {
        //   webSocket.send(JSON.stringify({
        //     error: "Your IP is being rate-limited, please try again later."
        //   }));
        //   return;
        // }

        // I guess we'll use JSON.
        const data = JSON.parse(message.data);

        if (!receivedUserInfo) {
          // The first message the client sends is the user info message with their name. Save it
          // into their session object.
          // session.name = "" + (data.name || "anonymous");

          // Don't let people use ridiculously long names. (This is also enforced on the client,
          // so if they get here they are not using the intended client.)
          // if (session.name.length > 32) {
          //   webSocket.send(JSON.stringify({error: "Name too long."}));
          //   webSocket.close(1009, "Name too long.");
          //   return;
          // }

          // Deliver all the messages we queued up since the user connected.
          // session.blockedMessages.forEach(queued => {
          //   webSocket.send(queued);
          // });
          // delete session.blockedMessages;

          // Broadcast to all other connections that this user has joined.
          this.broadcast({ joined: session.name });

          webSocket.send(JSON.stringify({ ready: true }));

          // Note that we've now received the user info message.
          receivedUserInfo = true;

          return;
        }

        // Construct sanitized message for state and broadcast.
        let nextData = { name, message: data.message };

        // Block people from sending overly long messages. This is also enforced on the client,
        // so to trigger this the user must be bypassing the client code.
        if (nextData.message.length > 256) {
          webSocket.send(JSON.stringify({ error: "Message too long." }));

          return;
        }

        // Add timestamp. Here's where this.lastTimestamp comes in -- if we receive a bunch of
        // messages at the same time (or if the clock somehow goes backwards????), we'll assign
        // them sequential timestamps, so at least the ordering is maintained.
        nextData.timestamp = Math.max(Date.now(), this.lastTimestamp + 1);
        this.lastTimestamp = nextData.timestamp;

        // Broadcast the message to all other WebSockets.
        let dataStr = JSON.stringify(nextData);
        this.broadcast(dataStr);

        // Save message.
        const key = new Date(data.timestamp).toISOString();
        await this.state.put(key, dataStr);
      } catch (err) {
        // Report any exceptions directly back to the client. As with our handleErrors() this
        // probably isn't what you'd want to do in production, but it's convenient when testing.
        webSocket.send(JSON.stringify({ error: err.stack }));
      }
    });

    // On "close" and "error" events, remove the WebSocket from the sessions list and broadcast
    // a quit message.
    let closeOrErrorHandler = () => {
      session.quit = true;
      this.sessions = this.sessions.filter((member) => member !== session);
      if (session.name) {
        this.broadcast({ quit: session.name });
      }
    };

    webSocket.addEventListener("close", closeOrErrorHandler);
    webSocket.addEventListener("error", closeOrErrorHandler);
  }

  /**
   * @param {string} message
   */
  broadcast(message) {
    // Apply JSON if we weren't given a string to start with.
    // if (typeof message !== "string") {
    //   message = JSON.stringify(message);
    // }

    // Iterate over all the sessions sending them messages.
    let quitters = [];
    this.sessions = this.sessions.filter((session) => {
      if (session.name) {
        try {
          session.webSocket.send(message);

          return true;
        } catch (err) {
          // Whoops, this connection is dead. Remove it from the list and arrange to notify
          // everyone below.
          session.quit = true;
          quitters.push(session);

          return false;
        }
      } else {
        // This session hasn't sent the initial user info message yet, so we're not sending them
        // messages yet (no secret lurking!). Queue the message to be sent later.
        session.blockedMessages.push(message);

        return true;
      }
    });

    quitters.forEach((quitter) => {
      if (quitter.name) {
        this.broadcast({ quit: quitter.name });
      }
    });
  }
}
