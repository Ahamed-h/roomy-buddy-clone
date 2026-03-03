# ==========================================================
# 🧠 AI INTERIOR DESIGN MASTER ENGINE (LIGHTWEIGHT)
# ==========================================================

import tensorflow as tf
import json
import torch, timm, cv2, numpy as np
import open_clip
import torch.nn as nn
from PIL import Image
from torchvision import transforms
from ultralytics import YOLO

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# ==========================================================
# --------------------- LOAD MODELS ------------------------
# ==========================================================

print("Loading YOLO...")
yolo_model = YOLO("yolo26n.pt")

print("Loading CLIP...")
clip_model, _, clip_preprocess = open_clip.create_model_and_transforms(
    'ViT-B-16', pretrained='laion400m_e32'
)
clip_model = clip_model.to(DEVICE)

print("Loading Trait Prediction Model...")
trait_model = tf.keras.models.load_model("full_style_trait_model_v2.keras")

with open("trait_rules.json", "r", encoding="utf-8") as f:
    STYLE_RULES = json.load(f)

TRAIT_LABELS = {
    "lighting": ["warm","neutral","cool"],
    "palette": ["bright","muted","dark"],
    "density": ["minimal","balanced","busy"],
    "material": ["wood","stone","metal","fabric"],
    "texture": ["soft","mixed","hard"],
    "geometry": ["curved","mixed","straight"],
    "contrast": ["low","medium","high"],
    "openness": ["open","moderate","compact"]
}
STYLE_CLASSES = [
    "asian","coastal","contemporary","craftsman","eclectic","farmhouse",
    "french-country","industrial","mediterranean","mid-century-modern",
    "modern","rustic","scandinavian","shabby-chic-style","southwestern",
    "traditional","transitional","tropical","victorian"
]

# ==========================================================
# ---------------- Trait Prediction ------------------------ 
# ==========================================================

def predict_traits(image_pil):
    img = image_pil.resize((224,224))
    arr = np.array(img)/255.0
    arr = np.expand_dims(arr,0)

    preds = trait_model.predict(arr, verbose=0)[0]

    traits = {}
    lighting_labels = TRAIT_LABELS["lighting"]
    traits["lighting"] = lighting_labels[int(np.argmax(preds))]

    for t in TRAIT_LABELS:
        if t != "lighting":
            traits[t] = "unknown"

    return traits

def infer_style(traits):
    possible_styles = []
    style_match_scores = {}

    for style, rules in STYLE_RULES.items():
        total_rules = len(rules)
        match_count = 0
        known_traits_used = 0

        for trait, expected in rules.items():
            val = traits.get(trait, "unknown")
            if val == "unknown":
                continue
            known_traits_used += 1
            if val == expected:
                match_count += 1

        if known_traits_used == 0:
            continue

        score = match_count / total_rules
        style_match_scores[style] = round(score, 2)

        if match_count >= max(1, known_traits_used // 2):
            possible_styles.append(style)

    if not possible_styles:
        possible_styles = ["no_clear_style"]
    if not style_match_scores:
        return ["no_clear_style"], {}

    sorted_styles = sorted(style_match_scores.items(), key=lambda x: x[1], reverse=True)
    top3 = sorted_styles[:3]
    possible_styles = [s for s, _ in top3]
    top_scores = {s: sc for s, sc in top3}

    return possible_styles, top_scores


# ---------------- Aesthetic Models ----------------

feature_cols = [
    'color_harmony','contrast_balance','lighting_quality','light_temperature',
    'spatial_balance','alignment_order','negative_space','visual_comfort',
    'clutter_control','material_quality','texture_depth','design_cohesion',
    'visual_hierarchy'
]

class FeaturePredictor(nn.Module):
    def __init__(self):
        super().__init__()
        self.backbone = timm.create_model("vit_small_patch16_224", pretrained=True)
        in_features = self.backbone.head.in_features
        self.backbone.head = nn.Identity()
        self.regressor = nn.Sequential(
            nn.Linear(in_features,512), nn.ReLU(), nn.Dropout(0.3),
            nn.Linear(512,len(feature_cols))
        )
    def forward(self,x): return self.regressor(self.backbone(x))

class RankingModel(nn.Module):
    def __init__(self, feature_dim):
        super().__init__()
        self.backbone = timm.create_model("vit_small_patch16_224", pretrained=True)
        in_features = self.backbone.head.in_features
        self.backbone.head = nn.Identity()
        self.design_mlp = nn.Sequential(
            nn.Linear(feature_dim,128), nn.ReLU(), nn.Linear(128,64)
        )
        self.scorer = nn.Sequential(
            nn.Linear(in_features+64,256), nn.ReLU(),
            nn.Linear(256,1), nn.Sigmoid()
        )
    def forward(self,img,feat):
        return self.scorer(torch.cat([self.backbone(img), self.design_mlp(feat)],dim=1))

feature_model = FeaturePredictor().to(DEVICE).eval()
ranking_model = RankingModel(feature_dim=len(feature_cols)).to(DEVICE).eval()
feature_model.load_state_dict(torch.load("design_feature_extractor.pth",map_location=DEVICE))
ranking_model.load_state_dict(torch.load("ranking_aesthetic_model.pth",map_location=DEVICE))

tfm = transforms.Compose([
    transforms.Resize((224,224)),
    transforms.ToTensor(),
    transforms.Normalize([0.5]*3,[0.5]*3)
])

# ==========================================================
# ----------------- VISION FUNCTIONS -----------------------
# ==========================================================

MATERIALS = ["wood","fabric","metal","glass","marble","plastic"]

def detect_yolo(image_np):
    results = yolo_model(image_np)[0]
    objects = []
    for box in results.boxes:
        cls_id = int(box.cls[0])
        name = yolo_model.names[cls_id]
        conf = float(box.conf[0])
        x1,y1,x2,y2 = map(int,box.xyxy[0])
        objects.append({"name":name,"confidence":conf,"bbox":[x1,y1,x2,y2],"source":"YOLO"})
    return objects

def classify_material(crop):
    img = clip_preprocess(Image.fromarray(crop)).unsqueeze(0).to(DEVICE)
    text = open_clip.tokenize(MATERIALS).to(DEVICE)
    with torch.no_grad():
        imf = clip_model.encode_image(img)
        txf = clip_model.encode_text(text)
        imf /= imf.norm(dim=-1,keepdim=True)
        txf /= txf.norm(dim=-1,keepdim=True)
        probs = (imf @ txf.T).softmax(dim=-1)
    return MATERIALS[probs.argmax()]

def lighting_analysis(img):
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    b = float(gray.mean()) / 255
    return {"brightness": b, "natural_light": b > 0.5}

# ==========================================================
# 🧠 PERCEPTION CORRECTION LAYER
# ==========================================================

DECOR_CLASSES = ["clock","vase","frame","plate","wall art"]

# ==========================================================
# ---------------- AESTHETIC ENGINE ------------------------
# ==========================================================

def analyze_design_pil(image_pil):
    img = tfm(image_pil).unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        feats = feature_model(img).cpu().numpy().flatten()
        feat_tensor = torch.tensor(feats, dtype=torch.float32).unsqueeze(0).to(DEVICE)
        score = ranking_model(img, feat_tensor).clamp(0,1).item()

    fd = dict(zip(feature_cols, feats))

    # hierarchy perception correction
    if fd["visual_hierarchy"] < 0 and fd["negative_space"] > 0.6:
        fd["visual_hierarchy"] += 0.5
    if fd["design_cohesion"] < 0.2 and fd["color_harmony"] > 0.6:
        fd["design_cohesion"] += 0.35
    if fd["texture_depth"] < 0.3 and fd["visual_comfort"] > 0.8:
        fd["texture_depth"] += 0.25
    if fd["spatial_balance"] < 0 and fd["alignment_order"] > 0.4:
        fd["spatial_balance"] += 0.4

    tips = []
    if fd['lighting_quality'] < 0.2: tips.append("Improve layered lighting.")
    if fd['texture_depth'] < 0.2: tips.append("Add more texture layers.")
    if fd['clutter_control'] < 0.2: tips.append("Declutter surfaces.")

    return score, tips, fd

# ==========================================================
# ---------------- MASTER ANALYSIS -------------------------
# ==========================================================

def analyze_room(image_path):
    image_pil = Image.open(image_path).convert("RGB")
    img_np = np.array(image_pil)

    # Object detection (YOLO only)
    objects = detect_yolo(img_np)

    h, w = img_np.shape[:2]

    for o in objects:
        x1, y1, x2, y2 = map(int, o["bbox"])
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w - 1, x2), min(h - 1, y2)

        if x2 <= x1 or y2 <= y1:
            continue

        crop = img_np[y1:y2, x1:x2]
        if crop.size == 0:
            continue

        o["material"] = classify_material(crop)
        o["distance_m"] = 0.0  # No depth estimation without MiDaS

    # Remove decor clutter (simplified without depth)
    objects = [o for o in objects if o["name"] not in DECOR_CLASSES]

    lighting = lighting_analysis(img_np)
    aesthetic_score, design_tips, metrics = analyze_design_pil(image_pil)

    # ---- BASE TRAITS FROM MODEL (lighting only) ----
    traits = predict_traits(image_pil)

    # ---- DERIVE TRAITS FROM DESIGN METRICS ----
    if metrics["negative_space"] > 0.75:
        traits["density"] = "minimal"
        traits["openness"] = "open"
    elif metrics["negative_space"] > 0.5:
        traits["density"] = "balanced"
        traits["openness"] = "moderate"
    else:
        traits["density"] = "busy"
        traits["openness"] = "compact"

    if metrics["contrast_balance"] < 0.4:
        traits["contrast"] = "low"
    elif metrics["contrast_balance"] > 0.65:
        traits["contrast"] = "high"
    else:
        traits["contrast"] = "medium"

    if metrics["texture_depth"] > 0.6:
        traits["texture"] = "mixed"
    elif metrics["texture_depth"] < 0.3:
        traits["texture"] = "soft"
    else:
        traits["texture"] = "hard"

    if metrics["color_harmony"] > 0.7:
        traits["palette"] = "bright"
    elif metrics["color_harmony"] > 0.4:
        traits["palette"] = "muted"
    else:
        traits["palette"] = "dark"

    materials = [o["material"] for o in objects if "material" in o]
    if materials:
        traits["material"] = max(set(materials), key=materials.count)

    if metrics["alignment_order"] > 0.6:
        traits["geometry"] = "straight"
    elif metrics["alignment_order"] > 0.3:
        traits["geometry"] = "mixed"
    else:
        traits["geometry"] = "curved"

    possible_styles, style_scores = infer_style(traits)

    result = {
        "objects": objects,
        "lighting": lighting,
        "aesthetic_score": round(aesthetic_score, 2),
        "design_metrics": metrics,
        "recommendations": design_tips,
        "depth_map": [],  # No MiDaS — empty

        "style_traits": traits,
        "possible_styles": possible_styles,
        "style_match_scores": style_scores
    }

    return to_python_types(result)

# ==========================================================
# ---------------- UTILITIES -------------------------
# ==========================================================

def to_python_types(obj):
    if isinstance(obj, (np.integer,)): return int(obj)
    if isinstance(obj, (np.floating,)): return float(obj)
    if isinstance(obj, np.ndarray): return obj.tolist()
    if isinstance(obj, torch.Tensor): return obj.detach().cpu().tolist()
    if isinstance(obj, dict): return {k: to_python_types(v) for k, v in obj.items()}
    if isinstance(obj, list): return [to_python_types(v) for v in obj]
    return obj

# ==========================================================
# ---------------- RUN EXAMPLE -------------------------
# ==========================================================

if __name__ == "__main__":
    print(analyze_room("room.jpg"))
