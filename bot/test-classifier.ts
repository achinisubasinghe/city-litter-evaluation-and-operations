import { TrashClassifier } from "./classifier";
import sharp from "sharp";

async function runTest() {
  console.log("🧪 Testing TrashClassifier...");
  const classifier = new TrashClassifier();

  // Create a synthetic clean image (smooth blue sky)
  const cleanImgBuffer = await sharp({
    create: {
      width: 400,
      height: 400,
      channels: 3,
      background: { r: 135, g: 206, b: 235 },
    },
  })
    .jpeg()
    .toBuffer();

  const cleanResult = await classifier.classify(cleanImgBuffer);
  console.log("Result on clean synthetic image:", cleanResult);

  // Create a synthetic noisy/textured image
  const noisyImgBuffer = await sharp({
    create: {
      width: 400,
      height: 400,
      channels: 3,
      background: { r: 120, g: 80, b: 50 },
    },
  })
    .composite([
      {
        input: await sharp({
          create: {
            width: 150,
            height: 150,
            channels: 3,
            background: { r: 255, g: 255, b: 0 },
          },
        })
          .png()
          .toBuffer(),
        top: 50,
        left: 50,
      },
      {
        input: await sharp({
          create: {
            width: 100,
            height: 100,
            channels: 3,
            background: { r: 255, g: 0, b: 0 },
          },
        })
          .png()
          .toBuffer(),
        top: 220,
        left: 200,
      },
    ])
    .jpeg()
    .toBuffer();

  const texturedResult = await classifier.classify(noisyImgBuffer);
  console.log("Result on textured image:", texturedResult);

  console.log("✅ TrashClassifier test completed successfully!");
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
