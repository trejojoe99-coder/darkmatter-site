// build-rev: 2 — force fresh function publish (cache-bust orphaned artifacts)
// Public anonymous chat room. GET = recent messages; POST {action:send|clear}.
const { json, readJSON, writeJSON, adminOk, initBlobs } = require("./lib/shared");

const MAX_MESSAGES = 200;     // keep only the most recent N
const MAX_LEN = 500;          // per-message character cap

exports.handler = async function (event) {
  initBlobs(event);
  if (event.httpMethod === "OPTIONS") return json(200, {});

  if (event.httpMethod === "GET") {
    const messages = await readJSON("chat", []);
    return json(200, { messages });
  }

  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });

  try {
    const { action, handle, text, password } = JSON.parse(event.body || "{}");

    if (action === "send") {
      const h = String(handle || "").trim().slice(0, 20);
      const t = String(text || "").trim().slice(0, MAX_LEN);
      if (!h || !t) return json(400, { error: "Empty message" });

      const messages = await readJSON("chat", []);
      messages.push({ id: "m-" + Date.now() + "-" + Math.round(Math.random() * 1e4), handle: h, text: t, ts: Date.now() });
      const trimmed = messages.slice(-MAX_MESSAGES);
      await writeJSON("chat", trimmed);
      return json(200, { messages: trimmed });
    }

    if (action === "clear") {
      if (!adminOk(password)) return json(401, { error: "Unauthorized" });
      await writeJSON("chat", []);
      return json(200, { messages: [] });
    }

    return json(400, { error: "Bad request" });
  } catch (err) {
    return json(500, { error: err.message });
  }
};
