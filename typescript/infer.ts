import * as ort from "onnxruntime-node";
import sharp from "sharp";
import * as path from "path";

export interface TrashDetectionResult {
  hasTrash: boolean;
  confidence: number;
  label: "trash" | "clean";
  inferenceTimeMs: number;
}

export class TrashClassifier {
  private session: ort.InferenceSession | null = null;
  private readonly imgSize: number;
  private readonly threshold: number;

  // ImageNet normalization constants
  private readonly mean = [0.485, 0.456, 0.406];
  private readonly std = [0.229, 0.224, 0.225];

  constructor(imgSize = 384, threshold = 0.5) {
    this.imgSize = imgSize;
    this.threshold = threshold;
  }

  /**
   * Initializes the ONNX inference session.
   */
  async loadModel(modelPath: string): Promise<void> {
    this.session = await ort.InferenceSession.create(modelPath);
  }

  /**
   * Preprocesses image buffer to normalized float32 tensor of shape [1, 3, imgSize, imgSize].
   */
  private async preprocessImage(imagePath: string): Promise<ort.Tensor> {
    const { data } = await sharp(imagePath)
      .resize(this.imgSize, this.imgSize, { fit: "cover" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const totalPixels = this.imgSize * this.imgSize;
    const float32Array = new Float32Array(3 * totalPixels);

    // Convert interleaved HWC (RGBRGB...) to planar CHW ([R...], [G...], [B...]) with normalization
    for (let i = 0; i < totalPixels; i++) {
      const r = data[i * 3 + 0] / 255.0;
      const g = data[i * 3 + 1] / 255.0;
      const b = data[i * 3 + 2] / 255.0;

      float32Array[0 * totalPixels + i] = (r - this.mean[0]) / this.std[0];
      float32Array[1 * totalPixels + i] = (g - this.mean[1]) / this.std[1];
      float32Array[2 * totalPixels + i] = (b - this.mean[2]) / this.std[2];
    }

    return new ort.Tensor("float32", float32Array, [1, 3, this.imgSize, this.imgSize]);
  }

  /**
   * Runs classification on an image file path.
   */
  async classify(imagePath: string): Promise<TrashDetectionResult> {
    if (!this.session) {
      throw new Error("Model session not loaded. Call loadModel() first.");
    }

    const startTime = performance.now();
    const inputTensor = await this.preprocessImage(imagePath);

    // Execute ONNX graph
    const feeds: Record<string, ort.Tensor> = { input: inputTensor };
    const results = await this.session.run(feeds);

    // probability output from export wrapper
    const outputTensor = results.probability;
    const probability = Number((outputTensor.data as Float32Array)[0]);

    const hasTrash = probability >= this.threshold;
    const inferenceTimeMs = performance.now() - startTime;

    return {
      hasTrash,
      confidence: parseFloat(probability.toFixed(4)),
      label: hasTrash ? "trash" : "clean",
      inferenceTimeMs: parseFloat(inferenceTimeMs.toFixed(2))
    };
  }
}

// Example CLI usage
async function main() {
  const args = process.argv.slice(2);
  const modelPath = args[0] || path.join(__dirname, "../models/trash_classifier_384.onnx");
  const testImagePath = args[1];

  if (!testImagePath) {
    console.log("Usage: ts-node infer.ts <path-to-model.onnx> <path-to-image.jpg>");
    return;
  }

  const classifier = new TrashClassifier(384, 0.5);
  console.log(`Loading ONNX model from: ${modelPath}`);
  await classifier.loadModel(modelPath);

  console.log(`Classifying image: ${testImagePath}`);
  const result = await classifier.classify(testImagePath);

  console.log("Result:", JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main().catch(console.error);
}
