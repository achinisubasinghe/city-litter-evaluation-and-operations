# CLEO

CLEO is an urban litter detection, citizen reporting, and municipal collection platform built around a shared Convex backend and a 384x384 MobileNetV2 trash classifier.

The monorepo contains five components:

- **Worker mobile app in `app/`.** Expo and React Native application for municipal collection crews to view assigned routes, inspect incident photos, open GPS directions, and update task status from pending to in progress and resolved.
- **Admin web dashboard in `web/`.** React 19, Vite, and Tailwind CSS dashboard for municipal supervisors to monitor real-time incident feeds from Convex, inspect model confidence scores, open Google Maps coordinates, and filter tasks by status.
- **Citizen reporting bot in `bot/`.** Telegraf Telegram bot running `onnxruntime-node` in memory. Residents send a photo and a GPS pin; the bot classifies the image, discards clean scenes, and writes verified litter reports to Convex.
- **Truck edge pipeline in `edge/`.** Python runtime for a vehicle-mounted Raspberry Pi 4B with a camera, NEO-6M GPS receiver, and MPU-6050 IMU. It filters out blurred or high-vibration frames, projects coordinates forward along the vehicle heading, queues detections in SQLite while offline, and syncs them to Convex.
- **Classifier training and weights in `src/` and `models/`.** PyTorch training pipeline and exported 384x384 MobileNetV2 weights in ONNX and TorchScript formats with embedded sigmoid probabilities.

## Tech stack

| Component | Stack |
| --- | --- |
| Admin dashboard | React 19, Vite 6, Tailwind CSS 4, TypeScript |
| Worker mobile app | Expo, React Native, Expo Router, NativeWind |
| Telegram bot | Telegraf, ONNX Runtime Node, Sharp |
| Backend and storage | Convex |
| Edge hardware | Raspberry Pi 4B, Python, OpenCV, NEO-6M UART GPS, MPU-6050 I2C IMU, SQLite |
| Machine learning | PyTorch, MobileNetV2, ONNX, TorchScript |

## Getting started

### Prerequisites

- [Bun](https://bun.sh) 1.3 or later
- Python 3.10 or later for edge inference and model training
- A [Convex](https://convex.dev) deployment
- A Telegram bot token from BotFather

### Install dependencies

Install the root dependencies for the web dashboard, bot, and Convex functions:

```bash
bun install
```

Install the mobile application dependencies:

```bash
cd app
bun install
cd ..
```

### Environment variables

Copy `.env.example` to `.env` and `.env.local`:

```env
TELEGRAM_BOT_TOKEN="your-telegram-bot-token"
CONVEX_URL="https://your-deployment.convex.cloud"
VITE_CONVEX_URL="https://your-deployment.convex.cloud"
MODEL_PATH="models/trash_classifier_384.onnx"
TRASH_THRESHOLD="0.5"
```

### Run the admin dashboard

Start the Vite development server:

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

Build the production bundle:

```bash
bun run build
```

### Run the worker mobile app

Start the Expo server from the repository root:

```bash
bun run app
```

Target a specific platform:

```bash
bun run app:android
bun run app:ios
bun run app:web
```

### Run the Telegram bot

Start the bot with the local ONNX model:

```bash
bun run bot
```

The bot loads `models/trash_classifier_384.onnx`, connects to Convex, and polls Telegram updates.

### Run the truck edge pipeline

Create a virtual environment, install Python packages, and launch the hardware controller:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python edge/main_pipeline.py --model models/trash_classifier_384.onnx --lookahead 3.0 --min-sharpness 35.0
```

`edge/camera_quality.py` drops frames with a Laplacian variance below `35` or IMU vibration above `0.35g`. `edge/location_fusion.py` compensates for GPS capture latency and projects coordinates `3.0` meters ahead along the vehicle heading on the WGS-84 ellipsoid. `edge/offline_storage.py` and `edge/sync_service.py` buffer detections in SQLite and upload them when connectivity returns.

## Model training and export

Download the TACO and Intel Landscape datasets, build balanced splits, fine-tune MobileNetV2, evaluate on the test manifest, and export weights to ONNX and TorchScript:

```bash
./scripts/download_data.sh
python src/dataset_builder.py
python src/train.py --img-size 384 --epochs-warmup 3 --epochs-finetune 7 --batch-size 32
python src/evaluate.py --checkpoint checkpoints/best_model.pth --manifest data/processed/dataset_manifest.csv
python src/export.py --checkpoint checkpoints/best_model.pth --img-size 384
```

## Testing

Run the Python test suite for camera quality gating, geodesic location fusion, and stationary duplicate suppression:

```bash
pytest tests/test_camera_quality.py tests/test_location_fusion.py tests/test_stationary_suppression.py
```

Run the bot ONNX classifier verification script:

```bash
bun run test:classifier
```

## Project structure

```text
city-litter-evaluation-and-operations/
├── app/
│   ├── app.json
│   ├── eas.json
│   ├── package.json
│   └── src/
├── web/
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       └── index.css
├── bot/
│   ├── bot.ts
│   ├── classifier.ts
│   └── test-classifier.ts
├── edge/
│   ├── gps_tracker.py
│   ├── mpu6050_sensor.py
│   ├── location_fusion.py
│   ├── camera_quality.py
│   ├── offline_storage.py
│   ├── sync_service.py
│   └── main_pipeline.py
├── models/
│   ├── trash_classifier_384.onnx
│   ├── trash_classifier_384.onnx.data
│   └── trash_classifier_384.pt
├── convex/
│   ├── schema.ts
│   ├── reports.ts
│   └── http.ts
├── src/
│   ├── model.py
│   ├── train.py
│   ├── export.py
│   └── infer.py
├── tests/
│   ├── test_camera_quality.py
│   ├── test_location_fusion.py
│   └── test_stationary_suppression.py
├── docs/
├── scripts/
├── index.html
├── vite.config.ts
├── package.json
└── tsconfig.json
```
