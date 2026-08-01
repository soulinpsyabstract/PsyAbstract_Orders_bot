const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();
app.use(bodyParser.json());

// 🔑 Секреты будут храниться в Render → Environment Variables
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const NOTIFY_SECRET = process.env.NOTIFY_SECRET;

app.get("/", (req, res) => {
  res.send("✅ PsyAbstract Orders Bot is running!");
});

// Simple in-memory rate limit — 10 requests/minute per IP, no extra dependency.
const notifyHits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const windowStart = now - 60_000;
  const hits = (notifyHits.get(ip) || []).filter((t) => t > windowStart);
  hits.push(now);
  notifyHits.set(ip, hits);
  return hits.length > 10;
}

// Эндпойнт, чтобы сайт мог слать уведомления
app.post("/notify", async (req, res) => {
  if (!NOTIFY_SECRET || req.get("X-Notify-Secret") !== NOTIFY_SECRET) {
    return res.status(401).send({ error: "Unauthorized" });
  }

  if (rateLimited(req.ip)) {
    return res.status(429).send({ error: "Too many requests" });
  }

  const { order } = req.body;

  if (!order) {
    return res.status(400).send({ error: "Order data is missing" });
  }

  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: CHAT_ID,
      text: `🖼 Новый заказ: ${order}`
    });

    res.send({ ok: true });
  } catch (err) {
    console.error(err.response ? err.response.data : err.message);
    res.status(500).send({ error: "Failed to send Telegram message" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
