// build-rev: 2 — force fresh function publish (cache-bust orphaned artifacts)
// ─────────────────────────────────────────────────────────────
//  Dark Matter scheduler — runs every hour (Netlify Scheduled Fn).
//  Compares the current Central time against the admin-configured
//  schedule and auto-publishes:
//    • Morning market brief   (config.morningHour)
//    • Afternoon market brief (config.afternoonHour)
//    • Weekly deep-dive blog  (config.weeklyDay + weeklyHour, from topics[])
//  Run-markers in the config blob prevent double-posting.
// ─────────────────────────────────────────────────────────────
const {
  readJSON, writeJSON, fetchMarketData, initBlobs,
  dailyPostPrompt, weeklyPostPrompt, callAnthropic, parsePost, addPost,
} = require("./lib/shared");

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Current time in America/Chicago → { hour, weekday, dateKey, weekKey }
function chicagoNow() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour12: false, weekday: "short",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit",
  }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  const hour = parseInt(get("hour"), 10) % 24;
  const weekday = get("weekday");
  const dateKey = `${get("year")}-${get("month")}-${get("day")}`;
  // ISO-ish week key: date of the most recent Sunday
  const dayIdx = DAYS.indexOf(weekday);
  const d = new Date(`${dateKey}T00:00:00`);
  d.setDate(d.getDate() - dayIdx);
  const weekKey = d.toISOString().slice(0, 10);
  return { hour, weekday, dateKey, weekKey };
}

async function generateDaily(slot) {
  const market = await fetchMarketData();
  if (!market.length) return false;
  const raw = await callAnthropic(dailyPostPrompt(market, slot));
  const post = parsePost(raw);
  await addPost({ ...post, tag: "DAILY" });
  return true;
}

async function generateWeekly(cfg) {
  const topics = cfg.topics || [];
  if (!topics.length) return cfg.topicIndex;
  const idx = (cfg.topicIndex || 0) % topics.length;
  const topic = topics[idx];
  const raw = await callAnthropic(weeklyPostPrompt(topic));
  const post = parsePost(raw);
  await addPost({ ...post, tag: "WEEKLY" });
  return (idx + 1) % topics.length; // advance to next topic
}

const handler = async function (event) {
  initBlobs(event);
  const cfg = await readJSON("config", {});
  const c = {
    morningHour: 7, afternoonHour: 15, weeklyDay: "Sun", weeklyHour: 9,
    topics: [], topicIndex: 0, ...cfg,
  };
  const { hour, weekday, dateKey, weekKey } = chicagoNow();
  let changed = false;

  try {
    if (hour === c.morningHour && c.lastMorning !== dateKey) {
      if (await generateDaily("morning")) { c.lastMorning = dateKey; changed = true; }
    }
    if (hour === c.afternoonHour && c.lastAfternoon !== dateKey) {
      if (await generateDaily("afternoon")) { c.lastAfternoon = dateKey; changed = true; }
    }
    if (weekday === c.weeklyDay && hour === c.weeklyHour && c.lastWeekly !== weekKey && (c.topics || []).length) {
      c.topicIndex = await generateWeekly(c);
      c.lastWeekly = weekKey;
      changed = true;
    }
  } catch (e) {
    console.error("scheduler error:", e.message);
  }

  if (changed) await writeJSON("config", c);
  return { statusCode: 200, body: JSON.stringify({ ran: changed, hour, weekday }) };
};

// Schedule ("@hourly") is declared in netlify.toml → [functions."scheduler"].
exports.handler = handler;
