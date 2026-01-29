import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

interface TelegramLocation {
  latitude: number;
  longitude: number;
}

interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

interface TelegramChat {
  id: number;
  type: string;
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  photo?: TelegramPhotoSize[];
  location?: TelegramLocation;
  caption?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

async function sendTelegramMessage(
  token: string,
  chatId: number | string,
  text: string,
  replyMarkup?: unknown
) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
  });
}

http.route({
  path: "/telegram-webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      return new Response("TELEGRAM_BOT_TOKEN is not configured", { status: 500 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const update = body as TelegramUpdate;
    if (!update || !update.message) {
      return new Response("OK", { status: 200 });
    }

    const message = update.message;
    const chatId = message.chat.id;
    const user = message.from;
    const userId = user ? String(user.id) : String(chatId);
    const userName = user
      ? user.username || [user.first_name, user.last_name].filter(Boolean).join(" ")
      : undefined;

    // Handle /start command
    if (message.text && message.text.startsWith("/start")) {
      await sendTelegramMessage(
        token,
        chatId,
        `👋 <b>Welcome to Garbage & Incident Report Bot!</b>\n\n` +
          `You can report garbage or issues by sending:\n` +
          `1️⃣ A <b>photo</b> of the issue 📸 (AI will verify trash presence)\n` +
          `2️⃣ Your <b>location</b> 📍\n\n` +
          `Type /cancel anytime to clear an ongoing report.`
      );
      return new Response("OK", { status: 200 });
    }

    // Handle /cancel command
    if (message.text && message.text.startsWith("/cancel")) {
      await ctx.runMutation(api.reports.clearDraft, { userId });
      await sendTelegramMessage(
        token,
        chatId,
        `🔄 Draft cleared! Send a new photo or location whenever you wish to submit a report.`
      );
      return new Response("OK", { status: 200 });
    }

    // Location message handler for webhook
    if (message.location) {
      const { latitude, longitude } = message.location;
      const result = await ctx.runMutation(api.reports.saveDraftLocation, {
        userId,
        userName,
        chatId: String(chatId),
        latitude,
        longitude,
      });

      if (result.status === "completed") {
        await sendTelegramMessage(
          token,
          chatId,
          `🎉 <b>Report Submitted Successfully!</b>\n\n` +
            `📸 Photo: Saved\n` +
            `📍 Location: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}\n` +
            `🗺️ <a href="https://www.google.com/maps?q=${latitude},${longitude}">View on Google Maps</a>\n\n` +
            `Thank you for helping keep our surroundings clean! 🌱`,
          { remove_keyboard: true }
        );
      } else {
        await sendTelegramMessage(
          token,
          chatId,
          `📍 <b>Location received!</b> (${latitude.toFixed(6)}, ${longitude.toFixed(6)})\n\n` +
            `Now please send a <b>photo</b> 📸 of the garbage.`
        );
      }

      return new Response("OK", { status: 200 });
    }

    return new Response("OK", { status: 200 });
  }),
});

export default http;
