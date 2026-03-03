from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn, shutil, os, uuid
import torch
from dotenv import load_dotenv
from contextlib import asynccontextmanager
import json
import requests
import time

load_dotenv()

from room_ai_engine import analyze_room

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
TEMP_DIR = "temp_uploads"

COMFY_URL = "http://127.0.0.1:8188"
WORKFLOW_FILE = "workflow.json"

# 👇 IMPORTANT: change if your ComfyUI path differs
COMFY_INPUT_DIR = "ComfyUI/input"

os.makedirs(TEMP_DIR, exist_ok=True)
os.makedirs("static", exist_ok=True)

_models_loaded = False


# ================= LIFESPAN =================

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 Server ready!")
    yield
    print("🛑 Server shutting down")


app = FastAPI(
    title="AI Interior Design Engine v1.0",
    lifespan=lifespan
)

# ================= CORS =================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")


# ================= ROOT =================

@app.get("/")
async def root():
    return {"status": "Running", "device": DEVICE}


@app.get("/health")
async def health():
    return {"status": "healthy", "models_loaded": _models_loaded}


# ================= ANALYZE =================

@app.post("/analyze")
async def analyze_room_api(file: UploadFile = File(...)):
    global _models_loaded

    if not file.content_type.startswith("image/"):
        raise HTTPException(400, "Upload a valid image")

    temp_path = os.path.join(TEMP_DIR, f"{uuid.uuid4()}_{file.filename}")

    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        result = analyze_room(temp_path)
        _models_loaded = True
        return JSONResponse(content=result)
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


# ================= COMFYUI FUNCTIONS =================

def generate_with_comfy(local_image_path, prompt_text):

    # Copy image into ComfyUI input folder
    filename = os.path.basename(local_image_path)
    comfy_image_path = os.path.join(COMFY_INPUT_DIR, filename)
    shutil.copy(local_image_path, comfy_image_path)

    with open(WORKFLOW_FILE, "r") as f:
        workflow = json.load(f)

    # ✅ Correct node IDs from your workflow

    # Load Image node (ID "6")
    workflow["6"]["inputs"]["image"] = filename

    # Positive prompt node (ID "11")
    workflow["11"]["inputs"]["text"] = prompt_text

    # Negative prompt node (ID "12")
    workflow["12"]["inputs"]["text"] = "blurry, distorted furniture, extra walls"

    response = requests.post(
        f"{COMFY_URL}/prompt",
        json={"prompt": workflow}
    )

    if response.status_code != 200:
        raise Exception("Failed to submit to ComfyUI")

    return response.json()


def wait_for_result(prompt_id, timeout=300):

    start = time.time()

    while time.time() - start < timeout:

        r = requests.get(f"{COMFY_URL}/history/{prompt_id}")

        if r.status_code == 200:
            data = r.json()

            if prompt_id in data:
                outputs = data[prompt_id]["outputs"]

                for node in outputs.values():
                    if "images" in node:
                        return node["images"][0]["filename"]

        time.sleep(2)

    return None


# ================= DESIGN GENERATION =================

@app.post("/design/generate/2d/repaint")
async def generate_repaint(file: UploadFile = File(...), style_prompt: str = Form(...)):

    if not file.content_type.startswith("image/"):
        raise HTTPException(400, "Upload a valid image")

    temp_path = os.path.join(TEMP_DIR, f"{uuid.uuid4()}_{file.filename}")

    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        result = generate_with_comfy(temp_path, style_prompt)

        prompt_id = result.get("prompt_id")
        if not prompt_id:
            raise HTTPException(500, "Invalid ComfyUI response")

        filename = wait_for_result(prompt_id)

        if not filename:
            raise HTTPException(500, "Generation timed out")

        image_url = f"{COMFY_URL}/view?filename={filename}"

        return {
            "image_url": image_url,
            "prompt_used": style_prompt
        }

    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


# ================= CHAT =================

@app.post("/design/chat")
async def design_chat(session_id: str = Form(...), message: str = Form(...)):
    return {
        "response": f"Chat response to: '{message}' (session: {session_id})",
        "action": "generate",
        "params": {"style": "modern"}
    }


# ================= PROMPT ENHANCER =================

@app.post("/design/enhance_prompt")
async def enhance_prompt(evaluation_json: str = Form(...), user_style: str = Form(...)):
    eval_data = json.loads(evaluation_json)
    enhanced = f"{user_style} interior, improve {eval_data.get('recommendations', ['lighting'])[0]}"
    return {"enhanced_prompt": enhanced}


# ================= RUN =================

if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
