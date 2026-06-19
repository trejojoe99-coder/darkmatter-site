// build-rev: 2 — force fresh function publish (cache-bust orphaned artifacts)
// Auto-post schedule + weekly topics. GET = read; POST {action:save} (admin).
const { json, readJSON, writeJSON, adminOk } = require("./lib/shared");

const DEFAULTS = {
  morningHour: 7,      // 0-23, Central time
  afternoonHour: 15,
  weeklyDay: "Sun",    // Sun..Sat
  weeklyHour: 9,
  topics: [],
  topicIndex: 0,
};

// Internal run-markers (lastMorning / lastAfternoon / lastWeekly) live in the
// same blob but are not user-editable; we preserve them on save.
exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return json(200, {});

  if (event.httpMethod === "GET") {
    const cfg = await readJSON("config", DEFAULTS);
    return json(200, { config: { ...DEFAULTS, ...cfg } });
  }

  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });

  try {
    const { action, password, config } = JSON.parse(event.body || "{}");
    if (!adminOk(password)) return json(401, { error: "Unauthorized" });
    if (action !== "save" || !config) return json(400, { error: "Bad request" });

    const current = await readJSON("config", DEFAULTS);
    const merged = {
      ...DEFAULTS,
      ...current,                       // keep internal run-markers + topicIndex
      morningHour: clampHour(config.morningHour, current.morningHour ?? 7),
      afternoonHour: clampHour(config.afternoonHour, current.afternoonHour ?? 15),
      weeklyDay: config.weeklyDay || current.weeklyDay || "Sun",
      weeklyHour: clampHour(config.weeklyHour, current.weeklyHour ?? 9),
      topics: Array.isArray(config.topics) ? config.topics.filter(Boolean) : (current.topics || []),
    };
    await writeJSON("config", merged);
    return json(200, { config: merged });
  } catch (err) {
    return json(500, { error: err.message });
  }
};

function clampHour(v, fallback) {
  const n = parseInt(v, 10);
  return Number.isInteger(n) && n >= 0 && n <= 23 ? n : fallback;
}
