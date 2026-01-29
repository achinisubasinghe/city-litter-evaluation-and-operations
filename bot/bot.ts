// Fix for Bun read-only message property on AbortError / DOMException during stop/polling
try {
  if (typeof DOMException !== "undefined" && DOMException.prototype) {
    const desc = Object.getOwnPropertyDescriptor(DOMException.prototype, "message");
    if (desc && desc.configurable) {
      const sym = Symbol("customMessage");
      Object.defineProperty(DOMException.prototype, "message", {
        get() {
          return (this as any)[sym] !== undefined ? (this as any)[sym] : desc.get?.call(this);
        },
        set(v) {
          (this as any)[sym] = v;
        },
        configurable: true,
        enumerable: true,
      });
    }
  }
} catch {
  // Ignore
}

import { Telegraf, Markup } from "telegraf";
import { message } from "telegraf/filters";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { TrashClassifier } from "./classifier";
import dotenv from "dotenv";

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("❌ TELEGRAM_BOT_TOKEN is not defined in .env or environment!");
  process.exit(1);
}

const convexUrl =
  process.env.CONVEX_URL ||
  process.env.NEXT_PUBLIC_CONVEX_URL ||
  process.env.VITE_CONVEX_URL;

if (!convexUrl) {
  console.error("❌ CONVEX_URL is not defined in .env or environment!");
  process.exit(1);
}

console.log("🚀 Initializing Telegram Bot with AI Garbage Detection...");
console.log(`📡 Convex URL: ${convexUrl}`);

const bot = new Telegraf(token);
const convex = new ConvexHttpClient(convexUrl);
const classifier = new TrashClassifier();

// Pre-initialize classifier session
classifier.loadModel().catch((err) => {
  console.warn("Notice: Initialized classifier with fallback mode.", err.message);
});

// /start command
bot.start(async (ctx) => {
  const name = ctx.from.first_name || "Friend";
  await ctx.reply(
    `👋 <b>Hello ${name}! Welcome to the Smart Trash & Incident Reporting Bot.</b>\n\n` +
      `Help keep our environment clean! Our AI automatically verifies trash before logging reports 🌱\n\n` +
      `<b>How to report an issue:</b>\n` +
      `1️⃣ Send a <b>photo</b> of the garbage 📸\n` +
      `2️⃣ Our AI model will detect whether it contains garbage\n` +
      `3️⃣ If garbage is detected, share your <b>location</b> 📍 to file the report\n\n` +
      `<b>Available Commands:</b>\n` +
      `• /start - Show this welcome message\n` +
      `• /cancel - Reset and clear your active draft\n` +
      `• /myreports - View your past submissions`,
    { parse_mode: "HTML" }
  );
});

// /cancel command
bot.command("cancel", async (ctx) => {
  const userId = String(ctx.from.id);
  await convex.mutation(api.reports.clearDraft, { userId });
  await ctx.reply(
    "🔄 Draft cleared! Send a new photo or location whenever you are ready to report.",
    Markup.removeKeyboard()
  );
});

// /myreports command
bot.command("myreports", async (ctx) => {
  const userId = String(ctx.from.id);
  const reports = await convex.query(api.reports.getReportsByUser, {
    userId,
    limit: 5,
  });

  if (reports.length === 0) {
    return ctx.reply(
      "You have not submitted any reports yet. Send a photo or location to get started!"
    );
  }

  let msg = `📋 <b>Your Recent Reports (${reports.length}):</b>\n\n`;
  reports.forEach((r: any, idx: number) => {
    const date = new Date(r.createdAt).toLocaleString();
    const confStr = r.confidence ? ` (AI: ${(r.confidence * 100).toFixed(0)}%)` : "";
    msg += `${idx + 1}. <b>Status:</b> [${r.status.toUpperCase()}]${confStr}\n`;
    msg += `   📅 ${date}\n`;
    msg += `   📍 <a href="https://www.google.com/maps?q=${r.latitude},${r.longitude}">View on Google Maps</a>\n`;
    if (r.caption) {
      msg += `   💬 <i>${r.caption}</i>\n`;
    }
    msg += `\n`;
  });

  await ctx.reply(msg, {
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
  });
});

// Photo handler with ML Garbage Verification
bot.on(message("photo"), async (ctx) => {
  try {
    const userId = String(ctx.from.id);
    const chatId = String(ctx.chat.id);
    const userName =
      ctx.from.username ||
      [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(" ") ||
      undefined;
    const caption = ctx.message.caption;

    const photos = ctx.message.photo;
    const highestResPhoto = photos[photos.length - 1];

    const statusMsg = await ctx.reply("🔍 <i>Analyzing image with AI model...</i>", {
      parse_mode: "HTML",
    });

    // 1. Download photo from Telegram
    const fileLink = await ctx.telegram.getFileLink(highestResPhoto.file_id);
    const res = await fetch(fileLink.href);
    if (!res.ok) {
      throw new Error(`Failed to download image from Telegram: ${res.statusText}`);
    }
    const arrayBuf = await res.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuf);

    // 2. Run Trash Classifier
    const classification = await classifier.classify(imageBuffer);
    const confidencePct = (classification.confidence * 100).toFixed(1);

    // Try deleting the status message
    try {
      await ctx.telegram.deleteMessage(chatId, statusMsg.message_id);
    } catch {
      // Ignore if cannot delete
    }

    // 3. Check if Trash was Detected
    if (!classification.hasTrash) {
      const cleanPct = ((1 - classification.confidence) * 100).toFixed(1);
      await ctx.reply(
        `🌱 <b>Clean Image Detected</b> (Clean Score: ${cleanPct}%)\n\n` +
          `Our AI model analyzed your photo and did <b>not</b> detect visible garbage.\n` +
          `Because of this, no report has been logged to the database.\n\n` +
          `<i>Tip: If you're reporting small or obscured litter, try taking a closer photo directly facing the waste.</i>`,
        { parse_mode: "HTML" }
      );
      return;
    }

    // 4. Trash was detected! Save to Convex Storage & update draft
    console.log(`🗑️ Trash confirmed (${confidencePct}%). Uploading to Convex...`);

    const photoStorageId = await convex.action(api.reports.storeImageFromUrl, {
      url: fileLink.href,
    });

    const draftRes = await convex.mutation(api.reports.saveDraftPhoto, {
      userId,
      userName,
      chatId,
      photoStorageId,
      confidence: classification.confidence,
      caption,
    });

    if (draftRes.status === "completed") {
      await ctx.reply(
        `🎉 <b>Report Submitted Successfully!</b>\n\n` +
          `🗑️ <b>Trash Verified:</b> ${confidencePct}% confidence\n` +
          `📸 Photo: Saved to database\n` +
          `📍 Location: Linked\n\n` +
          `Thank you for helping keep our community clean! 🌱`,
        {
          parse_mode: "HTML",
          ...Markup.removeKeyboard(),
        }
      );
    } else {
      await ctx.reply(
        `🗑️ <b>Garbage Detected!</b> (${confidencePct}% confidence)\n\n` +
          `📸 Photo verified and saved to database.\n` +
          `Now please share the <b>location</b> 📍 where this was taken.\n` +
          `Tap the button below or attach your location pin:`,
        {
          parse_mode: "HTML",
          ...Markup.keyboard([
            [Markup.button.locationRequest("📍 Send Current Location")],
          ])
            .resize()
            .oneTime(),
        }
      );
    }
  } catch (error) {
    console.error("Error processing photo:", error);
    await ctx.reply(
      "❌ Sorry, an error occurred while processing the photo. Please try again."
    );
  }
});

// Location handler
bot.on(message("location"), async (ctx) => {
  try {
    const userId = String(ctx.from.id);
    const chatId = String(ctx.chat.id);
    const userName =
      ctx.from.username ||
      [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(" ") ||
      undefined;
    const { latitude, longitude } = ctx.message.location;

    const res = await convex.mutation(api.reports.saveDraftLocation, {
      userId,
      userName,
      chatId,
      latitude,
      longitude,
    });

    if (res.status === "completed") {
      await ctx.reply(
        `🎉 <b>Report Submitted Successfully!</b>\n\n` +
          `📸 Photo: Verified & Saved\n` +
          `📍 Coordinates: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}\n` +
          `🗺️ <a href="https://www.google.com/maps?q=${latitude},${longitude}">View on Google Maps</a>\n\n` +
          `Thank you for helping keep our community clean! 🌱`,
        {
          parse_mode: "HTML",
          ...Markup.removeKeyboard(),
        }
      );
    } else {
      await ctx.reply(
        `📍 <b>Location received!</b> (${latitude.toFixed(6)}, ${longitude.toFixed(6)})\n\n` +
          `Now please send a <b>photo</b> 📸 of the garbage. Our AI will automatically verify it!`
      );
    }
  } catch (error) {
    console.error("Error processing location:", error);
    await ctx.reply(
      "❌ Sorry, an error occurred while saving your location. Please try again."
    );
  }
});

// Fallback message handler
bot.on(message("text"), async (ctx) => {
  await ctx.reply(
    `💡 Please send a <b>photo</b> 📸 of garbage or your <b>location</b> 📍 to submit a report.\n\nType /start for instructions or /cancel to clear.`,
    { parse_mode: "HTML" }
  );
});

async function main() {
  try {
    // Clear webhook if one was previously registered so long polling works cleanly
    await bot.telegram.deleteWebhook({ drop_pending_updates: false });
    console.log("🧹 Webhook check complete. Starting bot polling...");

    await bot.launch(() => {
      console.log("🤖 Telegram Bot is running in polling mode!");
      console.log("👉 Send a message or photo to the Telegram bot to test.");
    });
  } catch (err) {
    console.error("Failed to start bot:", err);
  }
}

main();

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
