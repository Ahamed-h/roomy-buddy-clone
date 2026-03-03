# aivo.ai — Local Setup Guide

## Prerequisites

- [Node.js](https://nodejs.org/) v18+ (with npm or bun)
- [Python](https://python.org/) 3.10+
- [Docker](https://www.docker.com/get-started/) (for RasterScan floor plan analysis)
- [Ollama](https://ollama.com/) (for local AI chat)
- A [Supabase](https://supabase.com/) project (already configured if cloned from Lovable)
- A [Google Cloud](https://console.cloud.google.com/) project (for OAuth)

---

## Quick Start (All Local Services)

Start everything in **4 separate terminals**:

```bash
# Terminal 1 — RasterScan (floor plan analysis)
docker run -d -p 8888:8888 --name rasterscan rasterscan/floor-plan-recognition:latest-cpu

# Terminal 2 — Ollama (AI chat)
ollama pull tinyllama
ollama serve

# Terminal 3 — ComfyUI (image generation)
cd ComfyUI
python main.py --cpu

# Terminal 4 — FastAPI server (main backend)
cd huggingface
pip install -r requirements.txt
python server.py
```

Then start the frontend:

```bash
npm install
npm run dev
```

### Service Map

| Service | Port | Purpose |
|---------|------|---------|
| Frontend (Vite) | 5173 | React app |
| FastAPI (`server.py`) | 8000 | Main API — analyze, chat, generate |
| RasterScan (Docker) | 8888 | Floor plan → walls/doors/rooms |
| ComfyUI | 8188 | AI image generation (Stable Diffusion) |
| Ollama | 11434 | Local LLM chat (TinyLlama) |

### Fallback Chain

The system is designed to work even if some services are offline:

- **Chat**: Ollama (local) → Lovable AI (cloud via Supabase edge function)
- **Floor plan analysis**: RasterScan (local Docker) → Gemini → OpenAI
- **Image generation**: ComfyUI (local) → Direct Gemini/DALL-E → Supabase edge function
- **Room analysis**: Local ML pipeline (YOLO, MiDaS, etc.) → Ollama vision → Cloud AI

---

## 1. Frontend Setup

```bash
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>
npm install
npm run dev
```

The app runs at `http://localhost:5173`.

### Environment Variables

The `.env` file is auto-populated with Supabase credentials:

```
VITE_SUPABASE_URL=https://<project-id>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon-key>
VITE_SUPABASE_PROJECT_ID=<project-id>
```

These are **publishable** keys and safe to commit.

---

## 2. Supabase Setup

### 2a. Database

The `designs` table should already exist from migrations. If not, run:

```sql
CREATE TABLE IF NOT EXISTS public.designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  name text NOT NULL DEFAULT 'Untitled Design',
  thumbnail_url text,
  data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.designs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own designs" ON public.designs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own designs" ON public.designs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own designs" ON public.designs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own designs" ON public.designs FOR DELETE USING (auth.uid() = user_id);
```

### 2b. Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → Create/select a project
2. Navigate to **APIs & Services → Credentials**
3. Click **Create Credentials → OAuth Client ID**
4. Choose **Web application**
5. Add **Authorized JavaScript origins**:
   - `http://localhost:5173` (local dev)
   - `https://your-production-domain.com` (production)
6. Add **Authorized redirect URLs**:
   - `https://<project-id>.supabase.co/auth/v1/callback`
7. Copy the **Client ID** and **Client Secret**

Then configure in Supabase:

1. Go to [Supabase Dashboard → Authentication → Providers](https://supabase.com/dashboard/project/whlzqtupucxeqkaqmcds/auth/providers)
2. Enable **Google** provider
3. Paste your Client ID and Client Secret
4. Under **Authentication → URL Configuration**:
   - Set **Site URL**: `http://localhost:5173` (or your production URL)
   - Add **Redirect URLs**: `http://localhost:5173`, `https://your-production-domain.com`

### 2c. Edge Functions

Edge functions are auto-deployed by Lovable. Available functions:

| Function | Purpose |
|----------|---------|
| `design-chat` | AI chat assistant (Gemini/OpenAI) |
| `generate-image` | AI image generation |
| `analyze-floorplan` | Floor plan analysis (RasterScan → Gemini → OpenAI) |
| `verify-analysis` | Verify room analysis results |

If running Supabase locally:

```bash
supabase start
supabase functions serve --env-file .env.local
```

---

## 3. Local AI Services

### 3a. Ollama — Chat AI (TinyLlama)

Ollama provides local LLM inference. TinyLlama (1.1B params) runs comfortably on CPU with ~1GB RAM.

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh   # Linux/macOS
# Windows: download from https://ollama.com/download

# Pull TinyLlama model (~600MB)
ollama pull tinyllama

# Start server (runs on port 11434)
ollama serve
```

**Verify it works:**

```bash
curl http://localhost:11434/api/generate -d '{"model":"tinyllama","prompt":"Hello","stream":false}'
```

**Expected performance** (i5 CPU, 16GB RAM):
- 1–3 seconds per response
- ~1GB RAM usage
- No GPU required

**Optional upgrade**: For better reasoning, try `ollama pull phi` (Phi-2, ~1.7GB).

### 3b. RasterScan — Floor Plan Analysis (Docker)

RasterScan extracts walls, doors, and rooms from floor plan images.

```bash
# Pull the CPU image (~2GB)
docker pull rasterscan/floor-plan-recognition:latest-cpu

# Run on port 8888
docker run -d -p 8888:8888 --name rasterscan rasterscan/floor-plan-recognition:latest-cpu
```

**Verify it works:**

```bash
curl http://localhost:8888/health
```

**API endpoint**: `POST http://localhost:8888/raster-to-vector-base64` — accepts `{"image": "<base64>"}`.

### 3c. ComfyUI — Image Generation

ComfyUI runs Stable Diffusion pipelines locally for room redesigns.

```bash
# Clone ComfyUI
git clone https://github.com/comfyanonymous/ComfyUI.git
cd ComfyUI

# Install dependencies
pip install -r requirements.txt

# Download models (place in ComfyUI/models/checkpoints/)
# - DreamShaper v8 (~2GB): https://civitai.com/models/4384
# - ControlNet Depth (~1.5GB): place in ComfyUI/models/controlnet/

# Start on CPU (slower but no GPU needed)
python main.py --cpu
```

**Runs on**: `http://127.0.0.1:8188`

**Expected performance** (CPU): 40–90 seconds per 512×512 image.

The `workflow.json` in `huggingface/` defines the pipeline:
- Node 6: Input image loader
- Node 11: Positive style prompt
- Node 12: Negative prompt

---

## 4. FastAPI Backend (`server.py`)

The main backend coordinates all AI services.

```bash
cd huggingface

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run server
python server.py
```

**Runs on**: `http://localhost:8000`

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check (shows device info) |
| `/health` | GET | Model loading status |
| `/analyze` | POST | Upload room image → full ML analysis |
| `/design/generate/2d/repaint` | POST | Room redesign via ComfyUI |
| `/design/chat` | POST | AI chat (Ollama → Lovable AI fallback) |
| `/design/enhance_prompt` | POST | Enhance prompt with evaluation data |

### Chat Endpoint Details

`POST /design/chat` accepts:
- `session_id` (form) — session identifier
- `message` (form) — user message
- `include_analysis` (form, optional) — set `true` to inject last room analysis into context

Returns structured JSON:

```json
{
  "response": "I suggest a modern minimalist redesign...",
  "action": "generate",
  "style_prompt": "modern minimalist living room, wooden floor...",
  "image_url": "http://127.0.0.1:8188/view?filename=ComfyUI_001.png"
}
```

When `action` is `"generate"`, the backend auto-triggers ComfyUI and returns the generated image URL.

### Environment Variables (Optional)

```bash
export SUPABASE_URL="https://<project-id>.supabase.co"
export SUPABASE_ANON_KEY="<anon-key>"
```

These are used for the Lovable AI fallback when Ollama is offline. Defaults are built in.

---

## 5. ML Backend Setup (Heavy Pipeline)

For the full ML analysis pipeline (YOLO, SAM, MiDaS, CLIP), additional setup is needed.

### 5a. Install ML Dependencies

```bash
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
pip install ultralytics transformers open-clip-torch timm
pip install opencv-python-headless scipy numpy scikit-image
pip install tensorflow
```

### 5b. Required Model Weights

Place these files in a `models/` directory:

| File | Size | Description |
|------|------|-------------|
| `yolo26n.pt` | ~6 MB | YOLO object detection |
| `sam_vit_h_4b8939.pth` | ~2.4 GB | Segment Anything |
| `full_style_trait_model_v2.keras` | ~50 MB | Style trait prediction |
| `design_feature_extractor.pth` | ~20 MB | Feature extraction |
| `ranking_aesthetic_model.pth` | ~5 MB | Aesthetic scoring |

### 5c. Required Files

- `master_engine.py` — Main analysis engine
- `trait_rules.json` — Style trait definitions

---

## 6. Alternative: Hugging Face Spaces Deployment

For GPU-powered inference, deploy to HF Spaces:

1. Create a new Space at [huggingface.co/new-space](https://huggingface.co/new-space) with **Docker SDK** and **T4 GPU**
2. Upload all files from the `huggingface/` folder
3. Add your model weights to a `models/` directory
4. Add `master_engine.py` and `trait_rules.json`
5. Push and wait for build (~5-10 min)

See [`huggingface/SETUP_GUIDE.md`](huggingface/SETUP_GUIDE.md) for detailed instructions.

---

## 7. Project Structure

```
├── src/
│   ├── components/         # React components
│   │   ├── design/         # Design Studio components
│   │   │   └── studio3d/   # 3D Editor (floorplan, viewer, marketplace)
│   │   └── ui/             # shadcn/ui components
│   ├── contexts/           # Auth context
│   ├── integrations/       # Supabase client & types
│   ├── lib/                # Utilities & design CRUD
│   ├── pages/              # Route pages
│   └── services/           # API service layer (ollama, directAI, api)
├── supabase/
│   └── functions/          # Edge functions (design-chat, analyze-floorplan, etc.)
├── huggingface/            # Local backend + HF deployment files
│   ├── server.py           # Main FastAPI server
│   ├── app.py              # HF Spaces entrypoint
│   ├── room_ai_engine.py   # ML analysis engine
│   ├── comfyui_bridge.py   # ComfyUI integration
│   ├── workflow.json       # ComfyUI pipeline definition
│   └── requirements.txt    # Python dependencies
└── public/                 # Static assets
```

---

## 8. Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest tests |

---

## 9. Design Studio Features

### 2D Design Tab

- Upload a room photo for AI analysis
- Select room type and design themes
- Generate redesigns using ComfyUI (local) or cloud AI
- Chat with RoomBot for design suggestions
- The **"Add evaluation result?"** toggle injects ML analysis data into redesign prompts

### 3D Design Tab

- Upload floor plan images for automatic wall/room detection
- Manually add walls and furniture
- Switch between 2D editor and 3D viewer
- Furniture marketplace with drag-and-drop placement

### Changing the Server URL

Users can change the backend URL in the Evaluate page settings. The default is stored in `localStorage` under `roomform_hf_url`.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Google Sign In not working | Ensure redirect URL matches exactly in Google Cloud and Supabase |
| "Analysis failed" on Evaluate | Check local ML server is running at `http://localhost:8000` |
| Dashboard empty | Sign in first — designs are user-scoped via RLS |
| Edge function errors | Check [Supabase Functions logs](https://supabase.com/dashboard/project/whlzqtupucxeqkaqmcds/functions) |
| Chat says "all providers offline" | Start Ollama (`ollama serve`) or check Supabase edge function |
| ComfyUI generation timeout | CPU mode is slow (40-90s). Check ComfyUI terminal for errors |
| RasterScan not responding | Run `docker ps` to verify container is running on port 8888 |
| Ollama slow/hanging | TinyLlama needs ~1GB free RAM. Close other heavy apps |
