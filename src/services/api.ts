// ==============================================================
// API service — mirrors main.py backend endpoints
// ==============================================================

const DEFAULT_API_URL = "http://localhost:8080";

export function getBackendUrl(): string {
  return localStorage.getItem("roomy_backend_url") || DEFAULT_API_URL;
}

export function setBackendUrl(url: string) {
  localStorage.setItem("roomy_backend_url", url.replace(/\/+$/, ""));
}

// Legacy aliases
export const getHfSpacesUrl = getBackendUrl;
export const setHfSpacesUrl = setBackendUrl;

// ==============================================================
// Types matching main.py responses
// ==============================================================

export interface DetectedObject {
  name: string;
  confidence: number;
  bbox: number[];
  material?: string;
  source: string;
}

export interface AnalysisResult {
  objects: DetectedObject[];
  lighting: {
    brightness: number;
    natural_light: boolean;
    warm_tone: boolean;
    saturation: number;
  };
  aesthetic_score: number;
  design_metrics: Record<string, number>;
  recommendations: string[];
  style_traits: Record<string, string>;
  possible_styles: string[];
  style_match_scores: Record<string, number>;
  color_palette?: string[];
  best_style_upgrade?: string;
  ai_summary?: string;
  analysis_source?: string;
  elapsed_s?: number;
  // Legacy compat
  brightness?: number;
  top_styles?: Array<{ style: string; score: number }>;
}

export interface GenerationResult {
  image_b64: string;
  prompt_used: string;
  style: string;
  elapsed_s: number;
}

export interface ChatResult {
  response: string;
  action: string;
  style_prompt: string;
  suggested_style: string;
  image_b64?: string;
  style_used?: string;
  generation_error?: string;
  elapsed_s: number;
}

export interface FloorPlanAnalysisResult {
  analysis: string;
  elapsed_s: number;
}

export interface FloorPlanGenerateResult {
  image_b64: string;
  description: string;
  prompt_used: string;
  style: string;
  elapsed_s: number;
}

export interface HealthResult {
  status: string;
  device: string;
  models_loaded: boolean;
  model_count: number;
}

// ==============================================================
// Helper
// ==============================================================

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${getBackendUrl()}${path}`;
  const resp = await fetch(url, init);
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`API ${resp.status}: ${text || resp.statusText}`);
  }
  return resp.json();
}

// ==============================================================
// Endpoints
// ==============================================================

/** GET /health */
export async function checkHealth(): Promise<HealthResult> {
  return apiFetch("/health");
}

/** GET /styles */
export async function getStyles(): Promise<{ styles: string[] }> {
  return apiFetch("/styles");
}

/** POST /analyze — room photo → full analysis */
export async function analyzeRoom(imageFile: File): Promise<AnalysisResult> {
  const fd = new FormData();
  fd.append("file", imageFile);
  return apiFetch("/analyze", { method: "POST", body: fd });
}

/** POST /design/repaint — image + prompt → redesigned room */
export async function repaintRoom(
  imageFile: File,
  prompt: string,
  style = "modern",
  strength = 0.72,
  steps = 30,
  guidance = 7.5,
): Promise<GenerationResult> {
  const fd = new FormData();
  fd.append("file", imageFile);
  fd.append("prompt", prompt);
  fd.append("style", style);
  fd.append("strength", String(strength));
  fd.append("steps", String(steps));
  fd.append("guidance", String(guidance));
  return apiFetch("/design/repaint", { method: "POST", body: fd });
}

/** POST /design/generate — text + style → room image */
export async function generateRoom(
  prompt: string,
  style = "modern",
  steps = 25,
  guidance = 7.5,
  size = 512,
): Promise<GenerationResult> {
  const fd = new FormData();
  fd.append("prompt", prompt);
  fd.append("style", style);
  fd.append("steps", String(steps));
  fd.append("guidance", String(guidance));
  fd.append("size", String(size));
  return apiFetch("/design/generate", { method: "POST", body: fd });
}

/** POST /design/chat — intelligent design chat */
export async function designChat(
  message: string,
  sessionId = "default",
  includeAnalysis = false,
  analysisJson = "",
): Promise<ChatResult> {
  const fd = new FormData();
  fd.append("message", message);
  fd.append("session_id", sessionId);
  fd.append("include_analysis", String(includeAnalysis));
  fd.append("analysis_json", analysisJson);
  return apiFetch("/design/chat", { method: "POST", body: fd });
}

/** POST /design/enhance_prompt */
export async function enhancePrompt(
  userStyle: string,
  evaluationJson = "{}",
): Promise<{ enhanced_prompt: string }> {
  const fd = new FormData();
  fd.append("user_style", userStyle);
  fd.append("evaluation_json", evaluationJson);
  return apiFetch("/design/enhance_prompt", { method: "POST", body: fd });
}

/** POST /floorplan/analyze */
export async function analyzeFloorplan(
  imageFile: File,
  question?: string,
): Promise<FloorPlanAnalysisResult> {
  const fd = new FormData();
  fd.append("file", imageFile);
  if (question) fd.append("question", question);
  return apiFetch("/floorplan/analyze", { method: "POST", body: fd });
}

/** POST /floorplan/generate-room */
export async function generateFloorplanRoom(
  imageFile: File,
  room = "living room",
  style = "modern",
  steps = 25,
): Promise<FloorPlanGenerateResult> {
  const fd = new FormData();
  fd.append("file", imageFile);
  fd.append("room", room);
  fd.append("style", style);
  fd.append("steps", String(steps));
  return apiFetch("/floorplan/generate-room", { method: "POST", body: fd });
}

// ==============================================================
// Mock data for demo / offline
// ==============================================================

export function getMockResult(): AnalysisResult {
  return {
    aesthetic_score: 0.72,
    lighting: { brightness: 0.65, natural_light: true, warm_tone: true, saturation: 0.45 },
    brightness: 65,
    objects: [
      { name: "sofa", confidence: 0.95, bbox: [], material: "fabric", source: "YOLO" },
      { name: "table", confidence: 0.89, bbox: [], material: "wood", source: "YOLO" },
      { name: "lamp", confidence: 0.82, bbox: [], material: "metal", source: "YOLO" },
    ],
    style_traits: { lighting: "warm", palette: "muted", density: "balanced", texture: "mixed", geometry: "mixed", contrast: "medium" },
    possible_styles: ["modern", "scandinavian"],
    style_match_scores: { modern: 0.71, scandinavian: 0.82, minimalist: 0.65 },
    design_metrics: {},
    recommendations: [
      "Add layered lighting for better ambiance",
      "Consider adding texture variety with throw pillows",
    ],
    color_palette: ["beige", "white", "oak wood"],
    ai_summary: "A moderately styled modern living room with good natural light.",
    analysis_source: "mock",
  };
}
