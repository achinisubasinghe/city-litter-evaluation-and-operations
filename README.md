# CLEO: City Litter Evaluation & Operations

[![Monorepo](https://img.shields.io/badge/Architecture-Monorepo-blue.svg)](#-monorepo-structure)
[![React](https://img.shields.io/badge/Web%20Dashboard-React%2019%20%2B%20Vite-61dafb.svg)](web/)
[![Mobile](https://img.shields.io/badge/Mobile%20App-Expo%20%2F%20React%20Native-000020.svg)](app/)
[![Bot](https://img.shields.io/badge/Bot-Telegraf%20%2B%20ONNX-2ca5e0.svg)](bot/)
[![Edge](https://img.shields.io/badge/Hardware-Raspberry%20Pi%204B%20%2B%20IMU%20%2B%20GPS-c51a4a.svg)](edge/)

**CLEO (Clean Living Environment Observer)** is an end-to-end urban cleanliness platform designed to automate litter detection, reporting, and municipal collection operations to advance UN Sustainable Development Goal 11 (Target 11.6: Sustainable Cities and Communities).

The repository is structured as a **monorepo** consisting of 4 core operational pillars, a real-time cloud backend, and trained AI models:
- 📱 **Mobile Application (`app/`)**: Mobile app for municipal garbage collecting workers to view assigned routes, inspect litter pins, and resolve collection tasks.
- 💻 **Web Application (`web/`)**: Real-time Admin Dashboard for local authorities and municipal councils to monitor incident streams, verify AI confidence, and manage task assignments.
- 🤖 **Citizen Reporting Bot (`bot/`)**: Telegram bot (`@fyp_qwerty_bot`) allowing residents to submit photo reports with instant AI litter verification and GPS location pairing.
- 🛰️ **Truck Edge Hardware Module (`edge/`)**: Vehicle-mounted edge IoT unit (Raspberry Pi 4B + Camera + NEO-6M GPS + MPU-6050 IMU) for automated on-the-road litter detection, camera quality gating, geodesic lookahead projection, and offline-to-cloud synchronization.
- 🧠 **AI Detection Models (`models/`)**: High-resolution 384x384 MobileNetV2 binary trash classification models developed and exported for edge and server runtimes (`.onnx`, `.onnx.data`, `.pt`).

---

## 🌟 Monorepo Components

### 1. Mobile Application (`app/`)
- Developed for municipal **garbage collecting workers**.
- Built with **Expo (React Native)** with Expo Router and NativeWind support.
- Displays assigned litter tasks, high-resolution incident snapshots, GPS directions to reported coordinates, and status updates (`Pending` -> `In Progress` -> `Resolved`).

### 2. Web Application - Admin Dashboard (`web/`)
- Real-time management interface for municipal supervisors.
- Built with **React 19**, **Vite**, **Tailwind CSS**, and **Convex Real-Time Database**.
- Features:
  - Live incident feed with real-time updates via WebSockets.
  - Verification badges displaying AI detection confidence (e.g. `94% Trash`).
  - Interactive Google Maps links based on geodesic GPS coordinates.
  - Multi-status switcher and analytical metric overview cards.

### 3. Citizen Reporting Bot (`bot/`)
- Built with **Telegraf** and in-memory **ONNX Runtime Node**.
- Interactive report submission with instant AI detection feedback.
- Two-step report pairing: Photo verification 📸 + Location GPS pin 📍.
- Automatically rejects clean environmental scenes to prevent database clutter.

### 4. Truck Edge Hardware Module (`edge/`)
- Truck-mounted autonomous edge unit running on **Raspberry Pi 4B**.
- **Location Fusion (`edge/location_fusion.py`)**: Real-time latency compensation ($\Delta t = t_{\text{capture}} - t_{\text{gps}}$) and geodesic forward projection ($d_{\text{lookahead}} = 3.0\text{ m}$) along vehicle heading using WGS-84 ellipsoid math.
- **Camera Quality Gating (`edge/camera_quality.py`)**: Rejects motion blur (Laplacian variance $< 35$) and pothole shocks (IMU vibration $> 0.35g$) before inference.
- **Offline SQLite Queue & Sync (`edge/offline_storage.py`, `edge/sync_service.py`)**: Safely stores detected incidents locally and syncs to Convex cloud when the truck returns to Wi-Fi/LTE coverage.

### 5. Developed AI Models (`models/`)
- High-resolution `384x384` MobileNetV2 binary classifier.
- Exported with embedded Sigmoid probability for single-pass inference without external post-processing:
  - `models/trash_classifier_384.onnx` & `models/trash_classifier_384.onnx.data` (ONNX format)
  - `models/trash_classifier_384.pt` (TorchScript format)

---

## 🚀 Installation & Quickstart

### 1. Install Monorepo Dependencies
```bash
# Install root Node/Bun dependencies for Web Dashboard, Bot, and Convex
bun install

# Install Mobile App dependencies
cd app && bun install && cd ..
```

### 2. Environment Configuration
Copy `.env.example` to `.env` and `.env.local` and add your credentials:
```env
TELEGRAM_BOT_TOKEN="your-telegram-bot-token"
CONVEX_URL="https://savory-ram-12.convex.cloud"
VITE_CONVEX_URL="https://savory-ram-12.convex.cloud"
MODEL_PATH="models/trash_classifier_384.onnx"
TRASH_THRESHOLD="0.5"
```

---

### 💻 3. Run the Admin Dashboard (Web Application)

Start the Vite + React admin dashboard locally:
```bash
bun run dev
# or: bun run web
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser to view the real-time incident dashboard.

To build the dashboard for production:
```bash
bun run build
```

---

### 📱 4. Run the Worker Mobile Application (`app/`)

Start the Expo development server:
```bash
# From the root directory:
bun run app

# Or navigate directly into app/:
cd app
bun run start
```
You can preview the app using:
- **Android Emulator**: `bun run app:android`
- **iOS Simulator**: `bun run app:ios`
- **Web**: `bun run app:web`
- **Expo Go**: Scan the QR code in the terminal with the Expo Go app.

---

### 🤖 5. Run the Citizen Telegram Bot (`bot/`)

Start the bot with in-memory ONNX classifier:
```bash
bun run bot
```
The bot will load `models/trash_classifier_384.onnx`, connect to Convex, and begin polling Telegram updates.

---

### 🛰️ 6. Run the Truck Edge Hardware Module (`edge/`)

```bash
# Setup Python virtualenv
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Run Edge hardware pipeline (camera + GPS + IMU + ONNX)
python edge/main_pipeline.py --model models/trash_classifier_384.onnx --lookahead 3.0 --min-sharpness 35.0
```

---

## 🧠 ML Training & Export Pipeline (`src/`)

```bash
# 1. Download datasets (TACO & Intel Landscapes)
./scripts/download_data.sh

# 2. Build balanced dataset splits
python src/dataset_builder.py

# 3. Train MobileNetV2
python src/train.py --img-size 384 --epochs-warmup 3 --epochs-finetune 7 --batch-size 32

# 4. Evaluate on test split
python src/evaluate.py --checkpoint checkpoints/best_model.pth --manifest data/processed/dataset_manifest.csv

# 5. Export to ONNX (for Bot & Edge)
python src/export.py --checkpoint checkpoints/best_model.pth --img-size 384
```

---

## 🧪 Testing

Run automated unit and integration tests:
```bash
# Run edge hardware & sensor fusion tests
pytest tests/test_camera_quality.py tests/test_location_fusion.py tests/test_stationary_suppression.py

# Run bot classifier benchmark
bun run test:classifier
```

---

## 📂 Monorepo Structure

```
city-litter-evaluation-and-operations/
├── app/                     # Mobile Application for Garbage Collecting Workers (Expo / React Native)
│   ├── app.json             # Expo project config
│   ├── eas.json             # Expo Application Services build profiles
│   ├── package.json         # Mobile app dependencies
│   └── src/                 # Worker screens, components, and hooks
├── web/                     # Web Application Admin Dashboard (React 19 + Vite + Tailwind CSS)
│   └── src/
│       ├── App.tsx          # Real-time incident dashboard with filters & map links
│       ├── main.tsx         # React entry point with ConvexProvider
│       └── index.css        # Tailwind CSS styles
├── bot/                     # Citizen Incident Reporting Telegram Bot
│   ├── bot.ts               # Telegraf runner with photo classifier & GPS handler
│   ├── classifier.ts        # In-memory ONNX inference engine (sharp + onnxruntime-node)
│   └── test-classifier.ts   # Classifier verification script
├── edge/                    # Truck Edge Hardware & Sensor Fusion Pipeline
│   ├── gps_tracker.py       # NEO-6M GPS UART NMEA parser with latency tracking
│   ├── mpu6050_sensor.py    # MPU-6050 6-DOF I2C accelerometer & gyro reader
│   ├── location_fusion.py   # Sensor fusion, latency compensation & geodesic lookahead projection
│   ├── camera_quality.py    # Optical sharpness, exposure, contrast & vibration checker
│   ├── offline_storage.py   # SQLite offline incident queue
│   ├── sync_service.py      # Convex cloud sync daemon
│   └── main_pipeline.py     # Master controller (Camera + ONNX + GPS + IMU)
├── models/                  # Developed & Exported AI Detection Models
│   ├── trash_classifier_384.onnx       # ONNX model with embedded Sigmoid
│   ├── trash_classifier_384.onnx.data  # ONNX tensor weights (8.5 MB)
│   └── trash_classifier_384.pt         # TorchScript model (9.0 MB)
├── convex/                  # Convex Real-Time Cloud Backend & Storage
│   ├── schema.ts            # Data models (incidents, drafts, coordinates, status)
│   ├── reports.ts           # Convex queries, mutations, and storage actions
│   └── http.ts              # Webhook endpoint (optional)
├── src/                     # Python ML Training & Export Pipeline
│   ├── model.py             # MobileNetV2 classification backbone
│   ├── train.py             # Two-stage fine-tuning script
│   ├── export.py            # ONNX & TorchScript exporter
│   └── infer.py             # Python inference CLI
├── tests/                   # Edge sensor fusion & quality test suite
│   ├── test_camera_quality.py
│   ├── test_location_fusion.py
│   └── test_stationary_suppression.py
├── docs/                    # Project Documentation, Proposals & Declarations
│   ├── VISION.md
│   └── Student Declaration of AI Tool use in this Assessment.docx
├── scripts/                 # Utility scripts (webhooks, data preparation)
├── index.html               # Web application entry HTML
├── vite.config.ts           # Vite configuration
├── package.json             # Root monorepo scripts & dependencies
└── tsconfig.json            # Root TypeScript configuration
```
