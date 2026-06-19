// build-rev: 2
// ─────────────────────────────────────────────────────────────
//  Dark Matter — shared helpers for all Netlify Functions
// ─────────────────────────────────────────────────────────────
const { getStore } = require("@netlify/blobs");

const STORE_NAME = "darkmatter";
const COINGECKO =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd" +
  "&ids=bitcoin,ethereum,solana,ripple,pax-gold&order=market_cap_desc" +
  "&sparkline=false&price_change_percentage=24h";

// JSON response helper with CORS
function json(statusCode, obj) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
    body: JSON.stringify(obj),
  };
}

function store() {
  return getStore(STORE_NAME);
}

async function readJSON(key, fallback) {
  try {
    const v = await store().get(key, { type: "json" });
    return v == null ? fallback : v;
  } catch (e) {
    return fallback;
  }
}

async function writeJSON(key, value) {
  await store().setJSON(key, value);
}

// Owner auth. The admin code lives ONLY in the ADMIN_PASSWORD env var (never in
// the repo). If it isn't set, all admin writes are denied.
function adminOk(password) {
  const expected = process.env.ADMIN_PASSWORD;
  return !!expected && !!password && String(password) === String(expected);
}

// Live prices, server-side (used by scheduler + manual generation)
async function fetchMarketData() {
  try {
    const res = await fetch(COINGECKO);
    if (!res.ok) throw new Error("coingecko " + res.status);
    return await res.json();
  } catch (e) {
    return [];
  }
}

function priceLines(marketData) {
  return marketData
    .map(
      (c) =>
        `${(c.symbol || "").toUpperCase()}: $${c.current_price?.toLocaleString()} (${
          c.price_change_percentage_24h >= 0 ? "+" : ""
        }${c.price_change_percentage_24h?.toFixed(2)}%)`
    )
    .join(", ");
}

// ── Prompt builders ──
function insightPrompt(marketData) {
  return `You are a sharp crypto analyst for Dark Matter, an underground crypto intelligence app.
Current market snapshot: ${priceLines(marketData)}
Write a 2-sentence market insight. Direct, trader tone, no fluff, no markdown. Plain text only.`;
}

function dailyPostPrompt(marketData, slot) {
  const sorted = [...marketData].sort(
    (a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h
  );
  const topGainer = sorted[0];
  const topLoser = sorted[sorted.length - 1];
  const today = new Date().toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
  const angle =
    slot === "afternoon"
      ? "This is an AFTERNOON recap — describe how the day has played out so far and where things stand right now."
      : "This is a MORNING brief — set up the day ahead: overnight moves and what to watch today.";

  return `You write crypto market updates for Dark Matter, an underground crypto app. Today is ${today}.
${angle}

Current prices: ${priceLines(marketData)}
Top gainer: ${topGainer?.name} (+${topGainer?.price_change_percentage_24h?.toFixed(2)}%)
Top loser: ${topLoser?.name} (${topLoser?.price_change_percentage_24h?.toFixed(2)}%)

Respond ONLY with a valid JSON object, no markdown, no backticks, no preamble:
{"title":"punchy title under 10 words","excerpt":"one sentence hook no fluff","body":"3 short paragraphs separated by \\n\\n. Trader tone, no newsletter speak."}`;
}

function weeklyPostPrompt(topic) {
  return `You write the weekly deep-dive blog for Dark Matter, an underground crypto app for people who already understand crypto. No hand-holding, no hype, sharp and useful.

This week's topic: "${topic}"

Write a focused blog post on that topic. Respond ONLY with a valid JSON object, no markdown, no backticks, no preamble:
{"title":"punchy title under 12 words","excerpt":"one sentence hook","body":"4 to 5 short paragraphs separated by \\n\\n. Concrete and practical, confident voice."}`;
}

// ── Anthropic call ──
async function callAnthropic(prompt) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not configured");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  return (
    data.content?.find((b) => b.type === "text")?.text ||
    "Could not generate response."
  );
}

// Parse the model's JSON post output safely
function parsePost(raw) {
  const clean = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

// Prepend a post to storage (keeps newest 50)
async function addPost(post) {
  const posts = await readJSON("posts", []);
  const today = new Date().toLocaleDateString("en-US", {
    month: "short", day: "numeric",
  });
  const full = {
    id: "p-" + Date.now(),
    tag: post.tag || "DAILY",
    date: post.date || today,
    title: post.title,
    excerpt: post.excerpt,
    body: post.body,
    read: post.read || "2 min",
    aiGenerated: post.aiGenerated !== false,
  };
  posts.unshift(full);
  await writeJSON("posts", posts.slice(0, 50));
  return full;
}

module.exports = {
  json, store, readJSON, writeJSON, adminOk,
  fetchMarketData, insightPrompt, dailyPostPrompt, weeklyPostPrompt,
  callAnthropic, parsePost, addPost,
};
