import dotenv from "dotenv";
dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error("❌ TELEGRAM_BOT_TOKEN not found in .env");
  process.exit(1);
}

async function deleteWebhook() {
  console.log("Deleting Telegram webhook...");
  const res = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`);
  const data = await res.json();
  console.log("Response:", data);
}

deleteWebhook();
