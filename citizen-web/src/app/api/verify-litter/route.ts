import { NextResponse } from "next/server";
import { getTrashClassifier } from "@/lib/classifier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE_BYTES = 12 * 1024 * 1024; // 12 MB
const ALLOWED_MIME_PREFIXES = ["image/"];

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("image");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing required image file in form field 'image'." },
        { status: 400 }
      );
    }

    if (
      file.type &&
      !ALLOWED_MIME_PREFIXES.some((prefix) => file.type.startsWith(prefix))
    ) {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload a JPEG, PNG, or WebP photo." },
        { status: 400 }
      );
    }

    if (file.size === 0 || file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Image must be non-empty and under 12 MB." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const classifier = getTrashClassifier();
    const result = await classifier.classify(buffer);

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("[/api/verify-litter] Error:", err);
    return NextResponse.json(
      { error: "Failed to run CLEO MobileNetV2 verification on the uploaded photo." },
      { status: 500 }
    );
  }
}
