"""
ComfyUI Bridge — Connects FastAPI to a local ComfyUI instance for interior redesign.

ComfyUI must be running at http://127.0.0.1:8188
Place the workflow JSON in ComfyUI or use the API directly.

Endpoints added to the main app:
  POST /design/generate/2d/comfyui — Submit room image + style prompt → get redesigned image
"""

import io
import json
import time
import uuid
import base64
import logging
import requests
from PIL import Image

logger = logging.getLogger("comfyui_bridge")

COMFYUI_URL = "http://127.0.0.1:8188"

# Interior redesign workflow template
# Uses: DreamShaper checkpoint + ControlNet Depth + Style LoRA + LCM LoRA
WORKFLOW_TEMPLATE = {
    "3": {
        "class_type": "KSampler",
        "inputs": {
            "seed": 0,
            "steps": 10,
            "cfg": 1.8,
            "sampler_name": "euler_ancestral",
            "scheduler": "normal",
            "denoise": 0.75,
            "model": ["15", 0],
            "positive": ["6", 0],
            "negative": ["7", 0],
            "latent_image": ["12", 0],
        },
    },
    "4": {
        "class_type": "CheckpointLoaderSimple",
        "inputs": {"ckpt_name": "dreamshaperXL_v21TurboDPMSDE.safetensors"},
    },
    "5": {
        "class_type": "LoadImage",
        "inputs": {"image": "input_room.png", "upload": "image"},
    },
    "6": {
        "class_type": "CLIPTextEncode",
        "inputs": {
            "text": "modern minimalist living room, wooden floor, soft lighting, realistic interior, 8k, professional photo",
            "clip": ["14", 1],
        },
    },
    "7": {
        "class_type": "CLIPTextEncode",
        "inputs": {
            "text": "ugly, blurry, low quality, watermark, text, cartoon, painting, drawing, sketch, deformed",
            "clip": ["14", 1],
        },
    },
    "8": {
        "class_type": "VAEDecode",
        "inputs": {"samples": ["3", 0], "vae": ["11", 0]},
    },
    "9": {
        "class_type": "SaveImage",
        "inputs": {"filename_prefix": "redesign", "images": ["8", 0]},
    },
    "10": {
        "class_type": "ControlNetLoader",
        "inputs": {"control_net_name": "control_v11f1p_sd15_depth.pth"},
    },
    "11": {
        "class_type": "VAELoader",
        "inputs": {"vae_name": "vae-ft-mse-840000-ema-pruned.safetensors"},
    },
    "12": {
        "class_type": "VAEEncode",
        "inputs": {"pixels": ["5", 0], "vae": ["11", 0]},
    },
    "13": {
        "class_type": "ControlNetApplyAdvanced",
        "inputs": {
            "strength": 0.85,
            "start_percent": 0.0,
            "end_percent": 1.0,
            "positive": ["6", 0],
            "negative": ["7", 0],
            "control_net": ["10", 0],
            "image": ["5", 0],
        },
    },
    "14": {
        "class_type": "LoraLoader",
        "inputs": {
            "lora_name": "interior_design_style.safetensors",
            "strength_model": 0.7,
            "strength_clip": 0.7,
            "model": ["4", 0],
            "clip": ["4", 1],
        },
    },
    "15": {
        "class_type": "LoraLoader",
        "inputs": {
            "lora_name": "lcm_lora_sd15.safetensors",
            "strength_model": 0.8,
            "strength_clip": 0.8,
            "model": ["14", 0],
            "clip": ["14", 1],
        },
    },
}


def is_comfyui_available() -> bool:
    """Check if ComfyUI is running."""
    try:
        r = requests.get(f"{COMFYUI_URL}/system_stats", timeout=2)
        return r.status_code == 200
    except Exception:
        return False


def upload_image_to_comfyui(image_bytes: bytes, filename: str = "input_room.png") -> str:
    """Upload an image to ComfyUI's input folder."""
    files = {"image": (filename, image_bytes, "image/png")}
    data = {"overwrite": "true"}
    r = requests.post(f"{COMFYUI_URL}/upload/image", files=files, data=data, timeout=10)
    r.raise_for_status()
    result = r.json()
    return result.get("name", filename)


def queue_prompt(workflow: dict) -> str:
    """Queue a workflow and return the prompt_id."""
    payload = {"prompt": workflow, "client_id": str(uuid.uuid4())}
    r = requests.post(f"{COMFYUI_URL}/prompt", json=payload, timeout=10)
    r.raise_for_status()
    return r.json()["prompt_id"]


def wait_for_result(prompt_id: str, timeout: int = 120) -> str | None:
    """Poll ComfyUI until the prompt completes, return base64 image."""
    start = time.time()
    while time.time() - start < timeout:
        try:
            r = requests.get(f"{COMFYUI_URL}/history/{prompt_id}", timeout=5)
            if r.status_code == 200:
                history = r.json()
                if prompt_id in history:
                    outputs = history[prompt_id].get("outputs", {})
                    for node_id, node_output in outputs.items():
                        images = node_output.get("images", [])
                        if images:
                            img_info = images[0]
                            img_r = requests.get(
                                f"{COMFYUI_URL}/view",
                                params={
                                    "filename": img_info["filename"],
                                    "subfolder": img_info.get("subfolder", ""),
                                    "type": img_info.get("type", "output"),
                                },
                                timeout=10,
                            )
                            if img_r.status_code == 200:
                                b64 = base64.b64encode(img_r.content).decode()
                                return f"data:image/png;base64,{b64}"
        except Exception as e:
            logger.warning(f"Polling error: {e}")
        time.sleep(2)
    return None


def generate_with_comfyui(image_bytes: bytes, style_prompt: str) -> dict:
    """
    Full pipeline: upload image → build workflow → queue → wait → return result.
    
    Returns: {"image_url": "data:image/png;base64,...", "description": "..."}
    """
    if not is_comfyui_available():
        raise ConnectionError("ComfyUI is not running at " + COMFYUI_URL)

    # Upload image
    uploaded_name = upload_image_to_comfyui(image_bytes)

    # Build workflow from template
    workflow = json.loads(json.dumps(WORKFLOW_TEMPLATE))

    # Set input image
    workflow["5"]["inputs"]["image"] = uploaded_name

    # Set style prompt
    workflow["6"]["inputs"]["text"] = (
        f"{style_prompt}, photorealistic interior, 8k, professional photography, "
        "natural lighting, high detail"
    )

    # Random seed
    import random
    workflow["3"]["inputs"]["seed"] = random.randint(0, 2**32 - 1)

    # Queue
    prompt_id = queue_prompt(workflow)
    logger.info(f"ComfyUI prompt queued: {prompt_id}")

    # Wait for result
    result_b64 = wait_for_result(prompt_id)
    if not result_b64:
        raise TimeoutError("ComfyUI generation timed out")

    return {"image_url": result_b64, "description": f"Generated with ComfyUI: {style_prompt}"}
