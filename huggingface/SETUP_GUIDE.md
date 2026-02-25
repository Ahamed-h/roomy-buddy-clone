# 🚀 Deploying Roomform.ai to Hugging Face Spaces

Step-by-step guide to deploy your ML models on HF Spaces with a free T4 GPU.

---

## Prerequisites

- A free [Hugging Face account](https://huggingface.co/join)
- Your model weights:
  - `sam_vit_h_4b8939.pth` (~2.4 GB)
  - `yolo26n.pt` (~6 MB)
  - `full_style_trait_model_v2.keras` (~50 MB)
  - `design_feature_extractor.pth` (~20 MB)
  - `ranking_aesthetic_model.pth` (~5 MB)
- Your Python code:
  - `master_engine.py` (your full analysis engine)
  - `trait_rules.json`

---

## Step 1: Create the Space

1. Go to [huggingface.co/new-space](https://huggingface.co/new-space)
2. **Space name**: `roomform-api` (or whatever you prefer)
3. **SDK**: Select **Docker**
4. **Hardware**: Select **T4 GPU (free)** ⚡
5. Click **Create Space**

---

## Step 2: Upload Files

Upload all files from this `huggingface/` folder to your Space:

```
your-space/
├── app.py                  ← Already provided (FastAPI wrapper)
├── Dockerfile              ← Already provided (GPU Docker setup)
├── requirements.txt        ← Already provided (all Python deps)
├── README.md               ← Already provided (HF metadata)
├── master_engine.py        ← YOUR FILE (copy from your project)
├── trait_rules.json        ← YOUR FILE (copy from your project)
└── models/                 ← Create this folder
    ├── sam_vit_h_4b8939.pth
    ├── yolo26n.pt
    ├── full_style_trait_model_v2.keras
    ├── design_feature_extractor.pth
    └── ranking_aesthetic_model.pth
```

### How to Upload

**Option A: Git (recommended for large files)**
```bash
# Install git-lfs for large model files
git lfs install

# Clone your Space
git clone https://huggingface.co/spaces/YOUR-USERNAME/roomform-api
cd roomform-api

# Copy files
cp /path/to/huggingface/* .
cp /path/to/master_engine.py .
cp /path/to/trait_rules.json .
mkdir -p models
cp /path/to/models/* models/

# Track large files with LFS
git lfs track "*.pth"
git lfs track "*.pt"
git lfs track "*.keras"

# Push
git add .
git commit -m "Initial deployment"
git push
```

**Option B: Web UI**
- Go to your Space → Files → Upload files
- Upload everything except model weights via web
- For large files (>50MB), use git-lfs

---

## Step 3: Update Model Paths

If your `master_engine.py` loads models from specific paths, update them:

```python
# Before (local paths)
model = torch.load("sam_vit_h_4b8939.pth")

# After (HF Spaces paths)
model = torch.load("models/sam_vit_h_4b8939.pth")
```

Make sure all model loading paths point to the `models/` directory.

---

## Step 4: Wait for Build

1. Go to your Space page
2. Watch the **Logs** tab — it shows Docker build progress
3. First build takes **5-10 minutes** (downloading PyTorch, etc.)
4. When you see `Uvicorn running on http://0.0.0.0:7860`, you're live!

---

## Step 5: Test Your API

Your Space URL will be:
```
https://YOUR-USERNAME-roomform-api.hf.space
```

Test the health endpoint:
```bash
curl https://YOUR-USERNAME-roomform-api.hf.space/
```

Test the analysis endpoint:
```bash
curl -X POST \
  https://YOUR-USERNAME-roomform-api.hf.space/analyze \
  -F "file=@your-room-photo.jpg"
```

---

## Step 6: Connect to Frontend

1. Go to the **Evaluate** page in roomform.ai
2. Click **Settings** (gear icon)
3. Paste your Space URL: `https://YOUR-USERNAME-roomform-api.hf.space`
4. Click **Save**
5. Upload a photo and click **Run AI Analysis**

---

## Troubleshooting

### "ML engine not loaded"
- Check the Logs tab for import errors
- Make sure `master_engine.py` is uploaded
- Verify model paths point to `models/` directory

### Build fails
- Check `requirements.txt` versions match your local setup
- Make sure `Dockerfile` has correct CUDA version for your PyTorch

### Out of memory
- SAM (vit_h) is ~2.4GB — fits on T4 (16GB) but leave room for other models
- Consider using SAM (vit_b) if memory is tight

### Space goes to sleep
- Free Spaces sleep after 48hrs of inactivity
- First request after sleep takes ~30s to wake up
- Upgrade to persistent Space ($0) to prevent sleeping

---

## Cost

**$0** — HF Spaces T4 GPU is free tier. No credit card needed.

The Space may sleep after inactivity but wakes up on the next request.
