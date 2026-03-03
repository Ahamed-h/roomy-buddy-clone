# aivo.ai — Full Offline Setup Guide

Run the entire AI interior design platform **100% offline** with no cloud dependencies.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Vite + React)                   │
│                    http://localhost:5173                     │
└──────────┬──────────┬──────────────┬───────────────┬────────┘
           │          │              │               │
     ┌─────▼────┐ ┌───▼────┐  ┌─────▼──────┐  ┌────▼─────┐
     │ FastAPI   │ │ Ollama │  │  ComfyUI   │  │RasterScan│
     │ :8000    │ │ :11434 │  │  :8188     │  │  :8888   │
     │ (Hub)    │ │ (Chat) │  │ (ImgGen)   │  │(Floorplan│
     └──────────┘ └────────┘  └────────────┘  └──────────┘
```

| Service | Port | Role | RAM |
|---------|------|------|-----|
| **Vite Dev Server** | 5173 | React frontend | ~200 MB |
| **FastAPI** (`server.py`) | 8000 | API hub, analysis orchestrator | ~500 MB–4 GB (with ML models) |
| **Ollama** | 11434 | Local LLM chat + vision | ~1–3 GB |
| **ComfyUI** | 8188 | Stable Diffusion image generation | ~2–4 GB |
| **RasterScan** (Docker) | 8888 | Floor plan wall/room detection | ~1 GB |

**Total RAM needed**: ~6–12 GB (depending on models loaded)

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| **Node.js** | 18+ | [nodejs.org](https://nodejs.org/) |
| **Python** | 3.10+ | [python.org](https://python.org/) |
| **Docker** | Any | [docker.com](https://www.docker.com/get-started/) |
| **Ollama** | Latest | [ollama.com](https://ollama.com/) |
| **Git** | Any | [git-scm.com](https://git-scm.com/) |
| **Git LFS** | Any | `git lfs install` (for large model files) |

---

## Step 1: Frontend Setup

```bash
git clone <YOUR_REPO_URL>
cd <YOUR_PROJECT>
npm install
```

### Configure for Offline

Create/update `.env` in project root:

```env
VITE_SUPABASE_URL=https://whlzqtupucxeqkaqmcds.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-anon-key>
```

> **Note**: Supabase auth still requires internet for Google OAuth. For fully offline use, you can skip sign-in — the app works without authentication for analysis and design features.

### Set Backend URL

Open the app → **Evaluate** page → **Settings** → set ML Server URL to:

```
http://localhost:8000
```

Or set it programmatically in browser console:

```js
localStorage.setItem("roomform_hf_url", "http://localhost:8000");
localStorage.setItem("aivo_ollama_url", "http://localhost:11434");
localStorage.setItem("aivo_ollama_model", "tinyllama");
```

---

## Step 2: Ollama — Chat & Vision AI

Ollama provides local LLM inference for the chat assistant and vision analysis.

### Install

```bash
# Linux / macOS
curl -fsSL https://ollama.com/install.sh | sh

# Windows — download from https://ollama.com/download
```

### Pull Models

```bash
# Chat model — lightweight, runs on CPU (~600 MB)
ollama pull tinyllama

# Vision model — for room/floorplan analysis (~2 GB)
ollama pull qwen2.5-vl:3b

# Optional: Better chat quality (~1.7 GB)
ollama pull phi
```

### Start

```bash
ollama serve
# Runs on http://localhost:11434
```

### Verify

```bash
# Health check
curl http://localhost:11434

# Test chat
curl http://localhost:11434/api/generate \
  -d '{"model":"tinyllama","prompt":"Hello","stream":false}'

# Test vision
curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen2.5-vl:3b",
    "messages": [{"role":"user","content":"Describe this room"}]
  }'
```

### Model Selection Guide

| Model | Size | Speed (i5 CPU) | Use Case |
|-------|------|-----------------|----------|
| `tinyllama` | 637 MB | 1–3s/response | Chat assistant |
| `phi` | 1.7 GB | 3–8s/response | Better reasoning |
| `qwen2.5-vl:3b` | 2.0 GB | 5–15s/response | Vision analysis |
| `llava:7b` | 4.7 GB | 10–30s/response | High-quality vision |

---

## Step 3: RasterScan — Floor Plan Analysis

RasterScan is a specialized CV model that detects walls, doors, windows, and rooms from floor plan images.

### Install & Run

```bash
# Pull the CPU image (~2 GB download)
docker pull rasterscan/floor-plan-recognition:latest-cpu

# Run container
docker run -d \
  -p 8888:8888 \
  --name rasterscan \
  --restart unless-stopped \
  rasterscan/floor-plan-recognition:latest-cpu
```

### Verify

```bash
# Health check
curl http://localhost:8888/health

# Test with a floor plan image (base64)
curl -X POST http://localhost:8888/raster-to-vector-base64 \
  -H "Content-Type: application/json" \
  -d '{"image": "<base64-encoded-floorplan>"}'
```

### Docker Management

```bash
# Stop
docker stop rasterscan

# Start again
docker start rasterscan

# View logs
docker logs rasterscan

# Remove entirely
docker rm -f rasterscan
```

---

## Step 4: ComfyUI — Image Generation

ComfyUI runs Stable Diffusion locally for room redesign image generation.

### Install

```bash
# Clone ComfyUI
git clone https://github.com/comfyanonymous/ComfyUI.git
cd ComfyUI

# Install Python dependencies
pip install -r requirements.txt

# For CPU-only (no NVIDIA GPU):
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
```

### Download Models

Place model files in the ComfyUI directory structure:

```
ComfyUI/
├── models/
│   ├── checkpoints/
│   │   └── dreamshaper_8.safetensors      # ~2 GB
│   ├── controlnet/
│   │   └── control_v11f1p_sd15_depth.pth  # ~1.5 GB
│   └── vae/
│       └── vae-ft-mse-840000.safetensors  # ~335 MB (optional)
```

**Download links**:

| Model | Size | Source |
|-------|------|--------|
| DreamShaper v8 | ~2 GB | [CivitAI](https://civitai.com/models/4384/dreamshaper) |
| ControlNet Depth | ~1.5 GB | [HuggingFace](https://huggingface.co/lllyasviel/ControlNet-v1-1) |
| VAE (optional) | ~335 MB | [HuggingFace](https://huggingface.co/stabilityai/sd-vae-ft-mse) |

### Start

```bash
cd ComfyUI

# CPU mode (slower but works on any machine)
python main.py --cpu

# GPU mode (if you have NVIDIA GPU with CUDA)
python main.py

# Low VRAM mode (4-6 GB VRAM)
python main.py --lowvram
```

**Runs on**: `http://127.0.0.1:8188`

### Verify

```bash
# Open ComfyUI web interface
open http://127.0.0.1:8188

# API health check
curl http://127.0.0.1:8188/system_stats
```

### Performance Expectations

| Hardware | Resolution | Time per Image |
|----------|-----------|----------------|
| CPU (i5) | 512×512 | 40–90 seconds |
| CPU (i7/Ryzen 7) | 512×512 | 25–50 seconds |
| GTX 1060 6GB | 512×512 | 5–10 seconds |
| RTX 3060 12GB | 512×512 | 2–5 seconds |
| RTX 4090 | 1024×1024 | 3–8 seconds |

---

## Step 5: FastAPI Backend

The main backend orchestrates all AI services.

### Install

```bash
cd huggingface

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install base dependencies
pip install -r requirements.txt
```

### Install ML Dependencies (Optional — for heavy analysis pipeline)

```bash
# PyTorch (CPU)
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Detection & segmentation
pip install ultralytics          # YOLO
pip install transformers         # OWL-ViT, SAM

# Style & aesthetics
pip install open-clip-torch      # CLIP material classification
pip install timm                 # Vision Transformer backbone
pip install tensorflow           # Style trait prediction

# Image processing
pip install opencv-python-headless scipy numpy scikit-image
```

### Download ML Model Weights

Place in a `models/` directory (relative to `huggingface/`):

```
huggingface/
├── models/
│   ├── yolo26n.pt                        # ~6 MB   — YOLO object detection
│   ├── sam_vit_h_4b8939.pth              # ~2.4 GB — Segment Anything
│   ├── full_style_trait_model_v2.keras    # ~50 MB  — Style trait prediction
│   ├── design_feature_extractor.pth      # ~20 MB  — Feature extraction
│   └── ranking_aesthetic_model.pth       # ~5 MB   — Aesthetic scoring
├── master_engine.py                       # Main analysis engine
├── trait_rules.json                       # Style rule definitions
└── server.py                              # FastAPI server
```

### Environment Variables

```bash
# Optional — only needed if you want cloud fallbacks
export SUPABASE_URL="https://<project-id>.supabase.co"
export SUPABASE_ANON_KEY="<anon-key>"

# ComfyUI input directory (auto-detected if ComfyUI is sibling folder)
export COMFYUI_INPUT_DIR="/path/to/ComfyUI/input"
```

### Start

```bash
cd huggingface
source venv/bin/activate
python server.py
# Runs on http://localhost:8000
```

### Verify

```bash
# Health check
curl http://localhost:8000/

# Expected response:
# {"status": "running", "device": "cpu"}

# Model status
curl http://localhost:8000/health

# Test analysis (with an image file)
curl -X POST http://localhost:8000/analyze \
  -F "file=@/path/to/room-photo.jpg"

# Test chat
curl -X POST http://localhost:8000/design/chat \
  -d "session_id=test&message=improve+lighting&include_analysis=true"

# Test image generation (requires ComfyUI running)
curl -X POST http://localhost:8000/design/generate/2d/repaint \
  -F "file=@/path/to/room-photo.jpg" \
  -F "style_prompt=modern scandinavian living room"
```

---

## Step 6: Start Everything

Open **4 terminals** and run:

```bash
# Terminal 1 — RasterScan (floor plan CV)
docker start rasterscan
# Or if first time: docker run -d -p 8888:8888 --name rasterscan rasterscan/floor-plan-recognition:latest-cpu

# Terminal 2 — Ollama (chat + vision LLM)
ollama serve

# Terminal 3 — ComfyUI (image generation)
cd ComfyUI && python main.py --cpu

# Terminal 4 — FastAPI (main backend)
cd huggingface && source venv/bin/activate && python server.py
```

Then start the frontend:

```bash
# Terminal 5 — Frontend
npm run dev
```

### Quick Health Check Script

Save as `check_services.sh`:

```bash
#!/bin/bash
echo "=== aivo.ai Service Health Check ==="

# Frontend
curl -s http://localhost:5173 > /dev/null 2>&1 && echo "✅ Frontend (5173)" || echo "❌ Frontend (5173)"

# FastAPI
curl -s http://localhost:8000/ > /dev/null 2>&1 && echo "✅ FastAPI  (8000)" || echo "❌ FastAPI  (8000)"

# Ollama
curl -s http://localhost:11434/ > /dev/null 2>&1 && echo "✅ Ollama   (11434)" || echo "❌ Ollama   (11434)"

# ComfyUI
curl -s http://127.0.0.1:8188/system_stats > /dev/null 2>&1 && echo "✅ ComfyUI  (8188)" || echo "❌ ComfyUI  (8188)"

# RasterScan
curl -s http://localhost:8888/health > /dev/null 2>&1 && echo "✅ RasterScan (8888)" || echo "❌ RasterScan (8888)"

echo "==================================="
```

```bash
chmod +x check_services.sh
./check_services.sh
```

---

## Offline Feature Map

| Feature | Required Services | Without Service |
|---------|-------------------|-----------------|
| **Room Photo Analysis** | FastAPI + (Ollama OR ML models) | Falls back to mock data |
| **AI Chat** | Ollama | No chat available |
| **Room Redesign** | FastAPI + ComfyUI | No image generation |
| **Floor Plan Analysis** | RasterScan (best) or Ollama Vision | No floor plan parsing |
| **Floor Plan Generation** | ComfyUI or Ollama | No generation |
| **Save/Load Designs** | Supabase (requires internet) | Use browser localStorage |
| **Google Sign-In** | Internet + Supabase | Skip auth, use app without sign-in |

---

## Fallback Chain (Offline Priority)

```
Chat:
  Ollama (tinyllama) → ❌ No fallback offline

Vision Analysis:
  Ollama (qwen2.5-vl:3b) → FastAPI ML pipeline (YOLO+MiDaS+CLIP) → ❌ Mock data

Floor Plan:
  RasterScan (Docker) → Ollama Vision → ❌ Manual wall drawing

Image Generation:
  ComfyUI (DreamShaper+ControlNet) → ❌ No fallback offline

Aesthetic Scoring:
  FastAPI ML pipeline (custom models) → Ollama estimation → ❌ Mock scores
```

---

## Minimal Offline Setup (Lightweight)

If you have limited RAM (<8 GB), run only the essentials:

```bash
# Just Ollama + Frontend (chat + basic vision, ~2 GB RAM)
ollama pull tinyllama
ollama serve

# In another terminal
npm run dev
```

This gives you:
- ✅ AI Chat assistant
- ✅ Basic vision analysis (with qwen2.5-vl model)
- ❌ No image generation
- ❌ No floor plan CV analysis
- ❌ No heavy ML pipeline

---

## GPU Acceleration (Optional)

### NVIDIA GPU (CUDA)

```bash
# Install CUDA toolkit
# https://developer.nvidia.com/cuda-downloads

# PyTorch with CUDA
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121

# ComfyUI with GPU
cd ComfyUI && python main.py  # Auto-detects CUDA

# Ollama auto-uses GPU if available
ollama serve
```

### Apple Silicon (M1/M2/M3)

```bash
# PyTorch with MPS
pip install torch torchvision

# ComfyUI with MPS
cd ComfyUI && python main.py --force-fp16

# Ollama natively supports Metal
ollama serve
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `CORS error` in browser | Ensure FastAPI CORS allows `http://localhost:5173` |
| `Ollama connection refused` | Run `ollama serve` — check port 11434 isn't blocked |
| `ComfyUI model not found` | Verify `.safetensors` file is in `ComfyUI/models/checkpoints/` |
| `RasterScan container exits` | Run `docker logs rasterscan` — may need more RAM |
| `torch out of memory` | Use `--cpu` flag, close other apps, or use smaller models |
| `Analysis returns mock data` | Backend ML models not loaded — check `curl localhost:8000/health` |
| `Chat says "all providers offline"` | Start Ollama: `ollama serve` |
| `Image generation timeout` | CPU mode is slow (40-90s) — wait or upgrade to GPU |
| `Port already in use` | Kill process: `lsof -ti:8000 | xargs kill` (replace port) |
| `Docker not running` | Start Docker Desktop or `sudo systemctl start docker` |

---

## Disk Space Requirements

| Component | Size |
|-----------|------|
| Frontend (`node_modules`) | ~500 MB |
| Ollama models (tinyllama + qwen2.5-vl) | ~2.6 GB |
| ComfyUI + DreamShaper + ControlNet | ~5 GB |
| RasterScan Docker image | ~2 GB |
| FastAPI ML models (all) | ~2.5 GB |
| Python venv + dependencies | ~2 GB |
| **Total** | **~15 GB** |

---

## Network Ports Summary

| Port | Service | Protocol |
|------|---------|----------|
| 5173 | Vite Dev Server | HTTP |
| 8000 | FastAPI Backend | HTTP |
| 8188 | ComfyUI | HTTP/WebSocket |
| 8888 | RasterScan | HTTP |
| 11434 | Ollama | HTTP |

Ensure these ports are not blocked by your firewall or occupied by other services.
