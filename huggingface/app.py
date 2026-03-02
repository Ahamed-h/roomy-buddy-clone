"""
Roomform.ai — FastAPI Backend for Hugging Face Spaces
Wraps your master_engine.py for deployment on HF Spaces with free T4 GPU.
"""

import os
import io
import json
import base64
import logging
import requests
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("roomform")

app = FastAPI(
    title="Roomform.ai API",
    description="AI-powered interior design evaluation using YOLO, CLIP, MiDaS, ViT, SAM, and TensorFlow",
    version="1.0.0",
)

# CORS — allow all origins for the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import your master engine
# Make sure master_engine.py is in the same directory
try:
    from master_engine import MasterEngine
    engine = MasterEngine()
    logger.info("✅ MasterEngine loaded successfully")
except Exception as e:
    logger.error(f"❌ Failed to load MasterEngine: {e}")
    engine = None


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "running",
        "service": "roomform.ai",
        "engine_loaded": engine is not None,
        "models": [
            "YOLO v26n",
            "OWL-ViT (owlvit-base-patch32)",
            "SAM (vit_h)",
            "CLIP (ViT-B/32)",
            "MiDaS (small)",
            "ViT Aesthetic (vit_small_patch16_224)",
            "TensorFlow Trait Model",
        ],
    }


@app.get("/health")
async def health():
    return {"status": "healthy", "engine": engine is not None}


@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    """
    Analyze a room image using the full ML pipeline.
    
    Accepts: JPG/PNG image file
    Returns: Full analysis JSON with metrics, objects, styles, etc.
    """
    if engine is None:
        raise HTTPException(
            status_code=503,
            detail="ML engine not loaded. Check model weights and dependencies.",
        )

    # Validate file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image (JPG/PNG)")

    try:
        # Read image
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
        logger.info(f"📸 Received image: {file.filename} ({image.size})")

        # Run analysis using your master engine
        result = engine.analyze(image)

        logger.info("✅ Analysis complete")
        return JSONResponse(content=result)

    except Exception as e:
        logger.error(f"❌ Analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


# ── ComfyUI Bridge ──
try:
    from comfyui_bridge import generate_with_comfyui, is_comfyui_available
    logger.info("✅ ComfyUI bridge imported")
except Exception as e:
    logger.warning(f"⚠️ ComfyUI bridge not available: {e}")
    generate_with_comfyui = None
    is_comfyui_available = lambda: False


@app.get("/comfyui/status")
async def comfyui_status():
    """Check if ComfyUI is running."""
    available = is_comfyui_available()
    return {"available": available, "url": "http://127.0.0.1:8188"}


@app.post("/design/generate/2d/comfyui")
async def generate_comfyui(file: UploadFile = File(...), style_prompt: str = "modern minimalist interior"):
    """Generate a room redesign using local ComfyUI pipeline."""
    if not generate_with_comfyui or not is_comfyui_available():
        raise HTTPException(status_code=503, detail="ComfyUI is not running. Start it with: python main.py --cpu")

    try:
        contents = await file.read()
        result = generate_with_comfyui(contents, style_prompt)
        return JSONResponse(content=result)
    except TimeoutError:
        raise HTTPException(status_code=504, detail="ComfyUI generation timed out (>120s)")
    except Exception as e:
        logger.error(f"ComfyUI generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"ComfyUI generation failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)
