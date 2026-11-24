import { NextResponse } from "next/server";
import sharp from "sharp";
import {
  WASTE_CATEGORIES,
  type CategorySuggestionResult,
  type WasteCategory,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function inferCategoryFromCaption(caption: string): WasteCategory | null {
  const lower = caption.toLowerCase();
  if (/(plastic|polythene|bottle|bag|wrapper|sachet|pet)/.test(lower)) {
    return "plastic";
  }
  if (/(organic|food|leaf|leaves|garden|fruit|vegetable|compost|green)/.test(lower)) {
    return "organic";
  }
  if (/(paper|cardboard|box|newspaper|carton)/.test(lower)) {
    return "paper";
  }
  if (/(metal|tin|can|iron|steel|scrap|wire)/.test(lower)) {
    return "metal";
  }
  if (/(glass|jar|broken bottle|mirror)/.test(lower)) {
    return "glass";
  }
  if (/(bulky|furniture|mattress|tire|tyre|sofa|appliance|debris|construction)/.test(lower)) {
    return "bulky";
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("image");
    const caption = String(formData.get("caption") ?? "");

    // 1. Optional external Cloud AI (EfficientNet) microservice hook
    const externalUrl = (process.env.WASTE_CATEGORY_API_URL ?? "").trim();
    if (externalUrl && file instanceof File) {
      try {
        const outbound = new FormData();
        outbound.append("image", file);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(externalUrl, {
          method: "POST",
          body: outbound,
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.ok) {
          const data = (await res.json()) as {
            category?: string;
            confidence?: number;
          };
          const normalized = data.category?.toLowerCase() as WasteCategory;
          if (WASTE_CATEGORIES.includes(normalized)) {
            const responseBody: CategorySuggestionResult = {
              category: normalized,
              confidence: Number(data.confidence ?? 0.88),
              source: "cloud_efficientnet",
            };
            return NextResponse.json(responseBody);
          }
        }
      } catch (externalErr) {
        console.warn("[/api/classify-category] Cloud endpoint fallback:", externalErr);
      }
    }

    // 2. Caption cue if citizen described the waste
    const captionCategory = inferCategoryFromCaption(caption);
    if (captionCategory) {
      const responseBody: CategorySuggestionResult = {
        category: captionCategory,
        confidence: 0.84,
        source: "heuristic",
      };
      return NextResponse.json(responseBody);
    }

    // 3. Lightweight chromatic cue fallback via sharp (defaults to Plastic, Sri Lanka's most common roadside litter)
    let suggested: WasteCategory = "plastic";
    let confidence = 0.78;

    if (file instanceof File && file.size > 0) {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const stats = await sharp(buffer)
          .resize(64, 64, { fit: "cover" })
          .removeAlpha()
          .stats();
        const [r, g, b] = stats.channels.map((ch) => ch.mean);
        if (g > r + 14 && g > b + 14) {
          suggested = "organic";
          confidence = 0.76;
        } else if (r > 165 && g > 145 && b < 125) {
          suggested = "paper";
          confidence = 0.72;
        } else {
          suggested = "plastic";
          confidence = 0.82;
        }
      } catch {
        suggested = "plastic";
      }
    }

    const responseBody: CategorySuggestionResult = {
      category: suggested,
      confidence,
      source: "heuristic",
    };
    return NextResponse.json(responseBody);
  } catch (err) {
    console.error("[/api/classify-category] Error:", err);
    return NextResponse.json(
      { category: "plastic", confidence: 0.75, source: "heuristic" } satisfies CategorySuggestionResult,
      { status: 200 }
    );
  }
}
