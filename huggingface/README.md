---
title: Roomform AI API
emoji: 🏠
colorFrom: green
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# Roomform.ai — AI Room Evaluation API

FastAPI backend for roomform.ai. Runs YOLO, CLIP, MiDaS, ViT, SAM, and TensorFlow models for interior design evaluation.

## API Endpoints

- `GET /` — Health check & model list
- `GET /health` — Simple health check
- `POST /analyze` — Upload room image → full analysis JSON

## Models Used

- **YOLO v26n** — Object detection
- **OWL-ViT** — Open-vocabulary detection
- **SAM (vit_h)** — Segmentation
- **CLIP (ViT-B/32)** — Material classification
- **MiDaS (small)** — Depth estimation
- **Custom ViT** — Aesthetic scoring
- **TensorFlow** — Style trait prediction
