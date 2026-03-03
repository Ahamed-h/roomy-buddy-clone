from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn, shutil, os, uuid
from dotenv import load_dotenv
from contextlib import asynccontextmanager
import json
import requests
import time

load_dotenv()

from room_ai_engine import analyze_room

DEVICE = "cpu"
TEMP_DIR = "temp_uploads"

COMFY_URL = "http://127.0.0.1:8188"
WORKFLOW_FILE = "workflow.json"

# 👇 IMPORTANT: change if your ComfyUI path differs
COMFY_INPUT_DIR = "ComfyUI/input"

os.makedirs(TEMP_DIR, exist_ok=True)
os.makedirs("static", exist_ok=True)

_models_loaded = False
LAST_ANALYSIS = None
LAST_IMAGE_PATH = None

OLLAMA_URL = "http://localhost:11434"


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

        global LAST_ANALYSIS, LAST_IMAGE_PATH
        LAST_ANALYSIS = result
        LAST_IMAGE_PATH = temp_path  # keep for chat-triggered generation

        return JSONResponse(content=result)
    finally:
        # Don't remove if stored as last image
        if os.path.exists(temp_path) and temp_path != LAST_IMAGE_PATH:
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


# ================= INTELLIGENT CHAT =================

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://whlzqtupucxeqkaqmcds.supabase.co")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndobHpxdHVwdWN4ZXFrYXFtY2RzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMDU4NjUsImV4cCI6MjA4NzU4MTg2NX0.5aheyRHAJPGRZxzzQlQI9WoAWVmjCRMM_5hGxOVqNac")


def is_ollama_available():
    """Quick check if Ollama is reachable."""
    try:
        r = requests.get(OLLAMA_URL, timeout=2)
        return r.ok
    except Exception:
        return False


def chat_with_ollama(prompt):
    """Send prompt to TinyLlama via Ollama and return raw text."""
    response = requests.post(
        f"{OLLAMA_URL}/api/generate",
        json={"model": "tinyllama", "prompt": prompt, "stream": False},
        timeout=60
    )
    if response.status_code != 200:
        raise Exception(f"Ollama error: {response.status_code}")
    return response.json()["response"]


def chat_with_supabase(message, room_context=None):
    """Fallback: call Supabase design-chat edge function (Lovable AI)."""
    url = f"{SUPABASE_URL}/functions/v1/design-chat"
    headers = {
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
    }
    body = {
        "messages": [{"role": "user", "content": message}],
    }
    if room_context:
        body["roomContext"] = room_context

    response = requests.post(url, json=body, headers=headers, timeout=30)

    if response.status_code != 200:
        raise Exception(f"Supabase edge function error: {response.status_code}")

    # Edge function returns SSE stream — collect full response
    full_text = ""
    for line in response.text.split("\n"):
        line = line.strip()
        if not line.startswith("data: "):
            continue
        data_str = line[6:]
        if data_str == "[DONE]":
            break
        try:
            chunk = json.loads(data_str)
            delta = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
            full_text += delta
        except Exception:
            continue

    return full_text


def parse_structured_output(raw_output):
    """Try to parse JSON from AI output, with fallback."""
    import re
    try:
        return json.loads(raw_output)
    except Exception:
        match = re.search(r'\{.*\}', raw_output, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except Exception:
                pass
    return {"reply": raw_output, "action": "none", "style_prompt": ""}


def build_chat_prompt(message, analysis_result=None):
    """Build the system + context + user prompt."""
    system_prompt = """You are an interior design AI assistant.

You MUST return valid JSON in this format:

{
  "reply": "text response to user",
  "action": "none OR generate",
  "style_prompt": "prompt to send to image generator if action is generate"
}

Rules:
- If user asks for redesign/makeover/restyle, set action to "generate"
- Otherwise set action to "none"
- style_prompt must be optimized for Stable Diffusion
- Always return valid JSON only, no extra text
"""
    context = ""
    if analysis_result:
        context = f"\nRoom Analysis:\n{json.dumps(analysis_result)}\n"

    return f"{system_prompt}\n{context}\nUser: {message}\nAssistant:"


def intelligent_chat(message, analysis_result=None):
    """Chat with structured JSON output. Ollama first, Lovable AI fallback."""

    # Strategy 1: Local Ollama (TinyLlama)
    if is_ollama_available():
        try:
            print("💬 Chat via Ollama (TinyLlama)")
            full_prompt = build_chat_prompt(message, analysis_result)
            raw_output = chat_with_ollama(full_prompt)
            return parse_structured_output(raw_output)
        except Exception as e:
            print(f"⚠️ Ollama failed: {e}, falling back to Lovable AI...")

    # Strategy 2: Supabase edge function (Lovable AI / Gemini / OpenAI)
    try:
        print("💬 Chat via Lovable AI (Supabase edge function)")
        # Build context-aware message
        context_msg = message
        if analysis_result:
            context_msg = f"Room context: {json.dumps(analysis_result)}\n\nUser request: {message}\n\nRespond with JSON: {{\"reply\": \"...\", \"action\": \"none|generate\", \"style_prompt\": \"...\"}}"

        raw_output = chat_with_supabase(context_msg, analysis_result)
        return parse_structured_output(raw_output)
    except Exception as e:
        print(f"❌ Lovable AI also failed: {e}")
        return {"reply": f"All chat providers offline. Error: {str(e)}", "action": "none", "style_prompt": ""}


@app.post("/design/chat")
async def design_chat(
    session_id: str = Form(...),
    message: str = Form(...),
    include_analysis: bool = Form(False)
):
    global LAST_ANALYSIS, LAST_IMAGE_PATH

    analysis_data = LAST_ANALYSIS if include_analysis else None

    decision = intelligent_chat(message, analysis_data)

    # Auto-trigger ComfyUI generation
    if decision.get("action") == "generate" and decision.get("style_prompt") and LAST_IMAGE_PATH:
        try:
            comfy_result = generate_with_comfy(LAST_IMAGE_PATH, decision["style_prompt"])
            prompt_id = comfy_result.get("prompt_id")

            if prompt_id:
                filename = wait_for_result(prompt_id)
                if filename:
                    decision["image_url"] = f"{COMFY_URL}/view?filename={filename}"
        except Exception as e:
            decision["generation_error"] = str(e)

    # Normalize output key
    decision["response"] = decision.pop("reply", decision.get("response", ""))
    return decision


# ================= PROMPT ENHANCER =================

@app.post("/design/enhance_prompt")
async def enhance_prompt(evaluation_json: str = Form(...), user_style: str = Form(...)):
    eval_data = json.loads(evaluation_json)
    enhanced = f"{user_style} interior, improve {eval_data.get('recommendations', ['lighting'])[0]}"
    return {"enhanced_prompt": enhanced}


# ================= RUN =================

if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
