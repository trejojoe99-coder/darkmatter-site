// On-demand Claude generation: market insight + manual blog post.
const { json, insightPrompt, dailyPostPrompt, weeklyPostPrompt, callAnthropic } = require("./lib/shared");

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return json(200, {});
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });

  if (!process.env.ANTHROPIC_API_KEY) {
    return json(500, { error: "API key not configured" });
  }

  try {
    const { type, marketData = [], slot, topic } = JSON.parse(event.body || "{}");

    let prompt;
    if (type === "market_insight") prompt = insightPrompt(marketData);
    else if (type === "daily_post") prompt = dailyPostPrompt(marketData, slot);
    else if (type === "weekly_post") prompt = weeklyPostPrompt(topic || "crypto self-custody");
    else return json(400, { error: "Unknown type" });

    const text = await callAnthropic(prompt);
    return json(200, { text });
  } catch (err) {
    return json(500, { error: err.message });
  }
};
