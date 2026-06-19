// Blog posts store. GET = list; POST {action:add|delete} (admin only).
const { json, readJSON, writeJSON, adminOk } = require("./lib/shared");

const SEED = [
  { id:"seed-1", tag:"ALPHA", date:"Jun 18", read:"3 min",
    title:"Why self-custody is the only real answer in 2025",
    excerpt:"Exchanges fail. Banks freeze accounts. The only wallet that can't be seized is the one only you control.",
    body:"Self-custody means you hold your own private keys — no exchange, no third party between you and your money.\n\nThe FTX collapse wiped out billions because users trusted a platform. Ledger, Trezor, Tangem — these aren't just hardware, they're financial independence in physical form.\n\nStart with a hardware wallet. Write your seed phrase on steel, not paper. Test a small recovery before going all-in. That's the whole playbook." },
  { id:"seed-2", tag:"MARKET", date:"Jun 17", read:"4 min",
    title:"SOL at $178: is the Solana run just getting started?",
    excerpt:"Network activity is up 40% month over month. Developer count is at an all-time high. The on-chain data doesn't lie.",
    body:"Solana's comeback from the FTX implosion is one of the most underrated stories in crypto.\n\nAt $178 today, it's still well below its 2021 ATH of $260. But the fundamentals are stronger than ever — transaction fees are near zero, throughput is high, and the developer ecosystem is the most active it's been.\n\nKey catalysts to watch: Firedancer mainnet upgrade, continued DePIN growth, and any spot ETF approval news." },
  { id:"seed-3", tag:"GUIDE", date:"Jun 15", read:"5 min",
    title:"Steel seed backup: the $30 upgrade that protects everything",
    excerpt:"Paper burns. Metal doesn't. Here's exactly how to back up your seed phrase the right way.",
    body:"Your seed phrase is the master key to everything. Paper burns at 233°C. Floods destroy ink. A house fire takes it all.\n\nCryptosteel Capsule and steel plates are the two best options. You stamp your 24 words into stainless steel — fire resistant, waterproof, and nearly indestructible.\n\nStore it somewhere separate from your hardware wallet. A fireproof safe works. A safety deposit box works. Anywhere only you know about works." },
];

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return json(200, {});

  // GET → list posts (seed on first ever load)
  if (event.httpMethod === "GET") {
    let posts = await readJSON("posts", null);
    if (posts == null) { posts = SEED; await writeJSON("posts", posts); }
    return json(200, { posts });
  }

  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });

  try {
    const { action, password, post, id } = JSON.parse(event.body || "{}");
    if (!adminOk(password)) return json(401, { error: "Unauthorized" });

    let posts = await readJSON("posts", []);

    if (action === "add" && post) {
      const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
      posts.unshift({
        id: "p-" + Date.now(),
        tag: post.tag || "DAILY",
        date: post.date || today,
        title: post.title,
        excerpt: post.excerpt,
        body: post.body,
        read: post.read || "2 min",
        aiGenerated: post.aiGenerated !== false,
      });
      posts = posts.slice(0, 50);
      await writeJSON("posts", posts);
      return json(200, { posts });
    }

    if (action === "delete" && id) {
      posts = posts.filter((p) => p.id !== id);
      await writeJSON("posts", posts);
      return json(200, { posts });
    }

    return json(400, { error: "Bad request" });
  } catch (err) {
    return json(500, { error: err.message });
  }
};
