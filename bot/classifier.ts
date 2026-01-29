import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";

export interface TrashDetectionResult {
  hasTrash: boolean;
  confidence: number;
  label: "trash" | "clean";
  inferenceTimeMs: number;
  isMock?: boolean;
}

export class TrashClassifier {
  private session: any = null;
  private readonly imgSize: number;
  private readonly threshold: number;
  private readonly modelPath: string;
  private isLoaded = false;
  private useMockFallback = false;

  // ImageNet normalization constants
  private readonly mean = [0.485, 0.456, 0.406];
  private readonly std = [0.229, 0.224, 0.225];

  constructor(
    modelPath = process.env.MODEL_PATH || path.join(__dirname, "../models/trash_classifier_384.onnx"),
    imgSize = 384,
    threshold = parseFloat(process.env.TRASH_THRESHOLD || "0.5")
  ) {
    this.modelPath = modelPath;
    this.imgSize = imgSize;
    this.threshold = threshold;
  }

  /**
   * Initializes the ONNX inference session.
   * If the model file does not exist, enables fallback mode without crashing.
   */
  async loadModel(): Promise<void> {
    if (this.isLoaded) return;

    if (!fs.existsSync(this.modelPath)) {
      console.warn(
        `⚠️ [TrashClassifier] ONNX model not found at "${this.modelPath}".\n` +
          `   Operating in fallback mode until model weights are exported/placed in models/.\n` +
          `   To export your trained checkpoint: python src/export.py --checkpoint checkpoints/best_model.pth`
      );
      this.useMockFallback = true;
      this.isLoaded = true;
      return;
    }

    try {
      // Dynamic import of onnxruntime-node to support different runtimes gracefully
      const ort = await import("onnxruntime-node");
      this.session = await ort.InferenceSession.create(this.modelPath);
      this.useMockFallback = false;
      this.isLoaded = true;
      console.log(`✅ [TrashClassifier] Loaded ONNX model from: ${this.modelPath}`);
    } catch (err) {
      console.error(
        `❌ [TrashClassifier] Failed to initialize ONNX runtime session:`,
        err
      );
      console.warn(`⚠️ [TrashClassifier] Falling back to mock detection mode.`);
      this.useMockFallback = true;
      this.isLoaded = true;
    }
  }

  /**
   * Preprocesses image buffer to normalized float32 tensor of shape [1, 3, imgSize, imgSize].
   */
  private async preprocessImage(
    imageInput: Buffer | string
  ): Promise<{ tensorData: Float32Array; dims: number[] }> {
    const { data } = await sharp(imageInput)
      .resize(this.imgSize, this.imgSize, { fit: "cover" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const totalPixels = this.imgSize * this.imgSize;
    const float32Array = new Float32Array(3 * totalPixels);

    // Convert interleaved HWC (RGBRGB...) to planar CHW ([R...], [G...], [B...]) with ImageNet normalization
    for (let i = 0; i < totalPixels; i++) {
      const r = data[i * 3 + 0] / 255.0;
      const g = data[i * 3 + 1] / 255.0;
      const b = data[i * 3 + 2] / 255.0;

      float32Array[0 * totalPixels + i] = (r - this.mean[0]) / this.std[0];
      float32Array[1 * totalPixels + i] = (g - this.mean[1]) / this.std[1];
      float32Array[2 * totalPixels + i] = (b - this.mean[2]) / this.std[2];
    }

    return {
      tensorData: float32Array,
      dims: [1, 3, this.imgSize, this.imgSize],
    };
  }

  /**
   * Classifies an image from buffer or file path.
   */
  async classify(imageInput: Buffer | string): Promise<TrashDetectionResult> {
    if (!this.isLoaded) {
      await this.loadModel();
    }

    const startTime = performance.now();

    if (this.useMockFallback) {
      // Basic heuristic for demo/test mode if ONNX model is missing:
      // Checks image statistics via sharp to produce a realistic probability
      try {
        const metadata = await sharp(imageInput).metadata();
        const stats = await sharp(imageInput).stats();
        // Use variance as a proxy for image clutter/texture (trash vs plain background)
        const avgStdDev =
          stats.channels.reduce((sum, c) => sum + c.stdev, 0) /
          stats.channels.length;
        // Map stddev ~ 20-70 to probability ~ 0.3 - 0.95
        const simulatedProb = Math.min(
          0.98,
          Math.max(0.15, Number((avgStdDev / 75.0).toFixed(4)))
        );
        const hasTrash = simulatedProb >= this.threshold;
        const inferenceTimeMs = performance.now() - startTime;

        return {
          hasTrash,
          confidence: simulatedProb,
          label: hasTrash ? "trash" : "clean",
          inferenceTimeMs: parseFloat(inferenceTimeMs.toFixed(2)),
          isMock: true,
        };
      } catch {
        const inferenceTimeMs = performance.now() - startTime;
        return {
          hasTrash: true,
          confidence: 0.85,
          label: "trash",
          inferenceTimeMs: parseFloat(inferenceTimeMs.toFixed(2)),
          isMock: true,
        };
      }
    }

    const ort = await import("onnxruntime-node");
    const { tensorData, dims } = await this.preprocessImage(imageInput);
    const inputTensor = new ort.Tensor("float32", tensorData, dims);

    const feeds: Record<string, any> = { input: inputTensor };
    const results = await this.session.run(feeds);

    // probability output from export wrapper
    const outputTensor = results.probability || results[Object.keys(results)[0]];
    const probability = Number((outputTensor.data as Float32Array)[0]);

    const hasTrash = probability >= this.threshold;
    const inferenceTimeMs = performance.now() - startTime;

    return {
      hasTrash,
      confidence: parseFloat(probability.toFixed(4)),
      label: hasTrash ? "trash" : "clean",
      inferenceTimeMs: parseFloat(inferenceTimeMs.toFixed(2)),
      isMock: false,
    };
  }
}
