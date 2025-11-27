# TypeScript ONNX Inference Client for Trash Detection

This package allows you to run high-resolution (384x384) trash detection inference on images using ONNX Runtime directly from TypeScript / JavaScript.

## Installation

Ensure Node.js (v18+) is installed on your system.

```bash
cd typescript
npm install
```

## Running Inference via CLI

```bash
npm run infer -- ../models/trash_classifier_384.onnx ../data/processed/test/trash/<sample_image>.jpg
```

## Programmatic Usage in Your TypeScript Application

```typescript
import { TrashClassifier } from "./infer";

async function run() {
  const classifier = new TrashClassifier(384, 0.5); // imgSize: 384, threshold: 0.5
  await classifier.loadModel("../models/trash_classifier_384.onnx");

  const result = await classifier.classify("path/to/camera_capture.jpg");
  console.log(result);
  // {
  //   hasTrash: true,
  //   confidence: 0.9421,
  //   label: 'trash',
  //   inferenceTimeMs: 14.2
  // }
}

run();
```

## Running in the Browser (React / Vue / Angular / Vanilla)
To run client-side directly in the browser:
1. Replace `onnxruntime-node` with `onnxruntime-web`.
2. Replace `sharp` with HTML5 `<canvas>` preprocessing (draw image to 384x384 canvas, extract ImageData RGBA pixels, normalize and create `ort.Tensor`).
3. Load the model using WebAssembly / WebGL backend:
```typescript
import * as ort from "onnxruntime-web";
const session = await ort.InferenceSession.create("/models/trash_classifier_384.onnx", {
  executionProviders: ["webgl", "wasm"]
});
```
