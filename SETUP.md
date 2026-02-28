# aivo.ai — Local Setup Guide

## Prerequisites

- [Node.js](https://nodejs.org/) v18+ (with npm or bun)
- [Python](https://python.org/) 3.10+
- A [Supabase](https://supabase.com/) project (already configured if cloned from Lovable)
- A [Google Cloud](https://console.cloud.google.com/) project (for OAuth)

---

## 1. Frontend Setup

```bash
# Clone the repo
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>

# Install dependencies
npm install

# Start dev server
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

The `design-chat` edge function is auto-deployed by Lovable. It uses the `LOVABLE_API_KEY` secret (already configured). If running Supabase locally:

```bash
supabase start
supabase functions serve design-chat --env-file .env.local
```

---

## 3. ML Backend Setup (Local Server)

The frontend expects a local ML server at `http://localhost:8000`.

### 3a. Install Python Dependencies

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install CPU-only PyTorch (no GPU required)
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Install remaining dependencies
pip install fastapi uvicorn[standard] python-multipart Pillow
pip install ultralytics transformers open-clip-torch timm
pip install opencv-python-headless scipy numpy scikit-image
pip install tensorflow
```

### 3b. Required Model Weights

Place these files in a `models/` directory:

| File | Size | Description |
|------|------|-------------|
| `yolo26n.pt` | ~6 MB | YOLO object detection |
| `sam_vit_h_4b8939.pth` | ~2.4 GB | Segment Anything |
| `full_style_trait_model_v2.keras` | ~50 MB | Style trait prediction |
| `design_feature_extractor.pth` | ~20 MB | Feature extraction |
| `ranking_aesthetic_model.pth` | ~5 MB | Aesthetic scoring |

### 3c. Required Files

- `master_engine.py` — Main analysis engine (your custom code)
- `trait_rules.json` — Style trait definitions

### 3d. Run the Server

```bash
python -m uvicorn app:app --host 0.0.0.0 --port 8000
```

The server exposes:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check |
| `/health` | GET | Simple health check |
| `/analyze` | POST | Upload room image → full analysis JSON |
| `/design/enhance_prompt` | POST | Enhance a redesign prompt with evaluation data |
| `/design/generate/2d/repaint` | POST | Generate a 2D room redesign |
| `/design/chat` | POST | Conversational AI design assistant |

### 3e. Design Studio — "Add Evaluation Result?"

In the 2D Design tab, the **"Add evaluation result?"** toggle controls whether your room's ML analysis data (aesthetic score, detected style, recommendations) is included when generating redesigns. When enabled, the AI uses your evaluation to produce more context-aware results. Run analysis first, then toggle this on before requesting a redesign.

### 3f. Changing the Server URL

Users can change the backend URL in the Evaluate page settings. The default is stored in `localStorage` under `roomform_hf_url`.

---

## 4. Alternative: Hugging Face Spaces Deployment

For GPU-powered inference, deploy to HF Spaces:

1. Create a new Space at [huggingface.co/new-space](https://huggingface.co/new-space) with **Docker SDK** and **T4 GPU**
2. Upload all files from the `huggingface/` folder
3. Add your model weights to a `models/` directory
4. Add `master_engine.py` and `trait_rules.json`
5. Push and wait for build (~5-10 min)

See [`huggingface/SETUP_GUIDE.md`](huggingface/SETUP_GUIDE.md) for detailed instructions.

---

## 5. Project Structure

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
│   └── services/           # API service layer
├── supabase/
│   └── functions/          # Edge functions (design-chat)
├── huggingface/            # HF Spaces deployment files
└── public/                 # Static assets
```

---

## 6. Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest tests |

---

## Troubleshooting

- **Google Sign In not working**: Ensure redirect URL matches exactly in both Google Cloud and Supabase dashboard
- **"Analysis failed" on Evaluate**: Check that the local ML server is running at `http://localhost:8000`
- **Dashboard empty**: Sign in first — designs are user-scoped via RLS
- **Edge function errors**: Check logs at [Supabase Functions Dashboard](https://supabase.com/dashboard/project/whlzqtupucxeqkaqmcds/functions/design-chat/logs)
