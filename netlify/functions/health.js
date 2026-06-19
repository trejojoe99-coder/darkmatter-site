// build-rev: 2 — force fresh function publish (cache-bust orphaned artifacts)
// Temporary diagnostic: verifies Netlify Blobs read+write and env presence.
// Safe to delete once chat is confirmed working.
const { getStore } = require("@netlify/blobs");

exports.handler = async function () {
  const out = {
    rev: 3,
    node: process.version,
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    hasAdminPassword: !!process.env.ADMIN_PASSWORD,
  };
  try {
    const store = getStore("darkmatter");
    await store.setJSON("__health", { t: Date.now() });
    const v = await store.get("__health", { type: "json" });
    out.blobs = "OK";
    out.readback = v;
  } catch (e) {
    out.blobs = "ERROR";
    out.error = e.message;
    out.stack = (e.stack || "").split("\n").slice(0, 4);
  }
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(out, null, 2),
  };
};
