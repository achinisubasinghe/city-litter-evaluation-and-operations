import dotenv from "dotenv";
dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const siteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL || "https://savory-ram-12.convex.site";

if (!token) {
  console.error("❌ TELEGRAM_BOT_TOKEN not found in .env");
  process.exit(1);
}

const webhookUrl = `${siteUrl}/telegram-webhook`;

async function setWebhook() {
  console.log(`Setting Telegram webhook to: ${webhookUrl}`);
  const res = await fetch(
    `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`
  );
  const data = await res.json();
  console.log("Response:", data);
}

setWebhook();
