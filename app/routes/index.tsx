import type { ActionArgs } from "@remix-run/cloudflare";
import { json } from "@remix-run/cloudflare";
import { Form } from "@remix-run/react";

export async function action({ request }: ActionArgs) {
  const formData = await request.formData();
  const name = formData.get("name");

  if (typeof name !== "string" || !name) {
    throw json({ error: "Name must be provided" }, { status: 404 });
  }

  return json({ name });
}

export default function Index() {
  return (
    <Form>
      <p>
        <label htmlFor="name">Name</label>
        <input type="text" required id="name" />
      </p>
      <button type="submit">Use this name</button>
    </Form>
  );
}
