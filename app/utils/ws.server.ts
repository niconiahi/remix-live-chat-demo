export function createWebsocket(): WebSocket {
  // If we are running via wrangler dev, use ws:
  const wss = document.location.protocol === "http:" ? "ws://" : "wss://";
  const hostname = document.location.host;
  const roomname = "some-roomname";
  const ws = new WebSocket(
    wss + hostname + "/api/room/" + roomname + "/websocket",
  );
  let rejoined = false;
  const startTime = Date.now();

  const rejoin = async () => {
    if (!rejoined) {
      rejoined = true;
      // This won't be needed
      //
      // currentWebSocket = null;

      // I won't be controlling HTML from here
      //
      // Clear the roster.
      // while (roster.firstChild) {
      //   roster.removeChild(roster.firstChild);
      // }

      // Don't try to reconnect too rapidly.
      let timeSinceLastJoin = Date.now() - startTime;
      if (timeSinceLastJoin < 10000) {
        // Less than 10 seconds elapsed since last join. Pause a bit.
        await new Promise((resolve) =>
          setTimeout(resolve, 10000 - timeSinceLastJoin),
        );
      }

      // OK, reconnect now!
      createWebsocket();
    }
  };

  ws.addEventListener("open", () => {
    // TODO: do something on "open"
    // This won't be needed
    //
    // currentWebSocket = ws;
    // Send user info message.
    // ws.send(JSON.stringify({ name: username }));
  });

  ws.addEventListener("message", (event) => {
    // TODO: validate with Zod
    let data = JSON.parse(event.data);

    // function addChatMessage(name, text) {
    //   let p = document.createElement("p");
    //   if (name) {
    //     let tag = document.createElement("span");
    //     tag.className = "username";
    //     tag.innerText = name + ": ";
    //     p.appendChild(tag);
    //   }
    //   p.appendChild(document.createTextNode(text));

    //   // Append the new chat line, making sure that if the chatlog was scrolled to the bottom
    //   // before, it remains scrolled to the bottom, and otherwise the scroll position doesn't
    //   // change.
    //   chatlog.appendChild(p);
    //   if (isAtBottom) {
    //     chatlog.scrollBy(0, 1e8);
    //   }
    // }

    if (data.error) {
      // I won't be controlling HTML from here
      //
      // addChatMessage(null, "* Error: " + data.error);
    } else if (data.joined) {
      // I won't be controlling HTML from here
      //
      // let p = document.createElement("p");
      // p.innerText = data.joined;
      // roster.appendChild(p);
    } else if (data.quit) {
      // I won't be controlling HTML from here
      //
      // for (let child of roster.childNodes) {
      //   if (child.innerText == data.quit) {
      //     roster.removeChild(child);
      //     break;
      //   }
      // }
    } else if (data.ready) {
      // I won't be controlling HTML from here
      //
      // All pre-join messages have been delivered.
      // if (!wroteWelcomeMessages) {
      //   wroteWelcomeMessages = true;
      //   addChatMessage(
      //     null,
      //     "* This is a demo app built with Cloudflare Workers Durable Objects. The source code " +
      //       "can be found at: https://github.com/cloudflare/workers-chat-demo",
      //   );
      //   addChatMessage(
      //     null,
      //     "* WARNING: Participants in this chat are random people on the internet. " +
      //       "Names are not authenticated; anyone can pretend to be anyone. The people " +
      //       "you are chatting with are NOT Cloudflare employees. Chat history is saved.",
      //   );
      //   if (roomname.length == 64) {
      //     addChatMessage(
      //       null,
      //       "* This is a private room. You can invite someone to the room by sending them the URL.",
      //     );
      //   } else {
      //     addChatMessage(null, "* Welcome to #" + roomname + ". Say hi!");
      //   }
      // }
    } else {
      // I won't be controlling HTML from here
      //
      // A regular chat message.
      // if (data.timestamp > lastSeenTimestamp) {
      //   addChatMessage(data.name, data.message);
      //   lastSeenTimestamp = data.timestamp;
      // }
    }
  });

  ws.addEventListener("close", (event) => {
    console.log("WebSocket closed, reconnecting:", event.code, event.reason);
    rejoin();
  });
  ws.addEventListener("error", (event) => {
    console.log("WebSocket error, reconnecting:", event);
    rejoin();
  });

  return ws;
}
