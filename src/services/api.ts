// API service for local ML server and edge functions

const DEFAULT_ML_URL = "http://localhost:8000";

export function getHfSpacesUrl(): string {
  return localStorage.getItem("roomform_hf_url") || DEFAULT_ML_URL;
}

export function setHfSpacesUrl(url: string) {
  localStorage.setItem("roomform_hf_url", url);
}

// Response shape from localhost:8000/analyze
export interface AnalysisResult {
  aesthetic_score: number;
  lighting: { brightness: number };
  objects: Array<{
    name: string;
    confidence: number;
    material: string;
    distance_m: number;
    source: string;
  }>;
  style_traits: Record<string, number>;
  possible_styles: string[];
  style_match_scores: Record<string, number>;
  depth_map: number[][];
  recommendations: string[];
  // Legacy compat fields (computed client-side)
  brightness?: number;
  top_styles?: Array<{ style: string; score: number }>;
  design_metrics?: Record<string, number>;
  material_distribution?: Record<string, number>;
}

/** Normalize API response to fill in computed fields for backward compat */
function normalizeResult(raw: any): AnalysisResult {
  const result: AnalysisResult = { ...raw };
  // brightness shortcut
  result.brightness = raw.lighting?.brightness ?? raw.brightness ?? 0;
  // top_styles from style_match_scores
  if (!result.top_styles && result.style_match_scores) {
    result.top_styles = Object.entries(result.style_match_scores)
      .map(([style, score]) => ({ style, score: score as number }))
      .sort((a, b) => b.score - a.score);
  }
  // design_metrics fallback
  if (!result.design_metrics) {
    result.design_metrics = {};
  }
  // material_distribution from objects
  if (!result.material_distribution && result.objects) {
    const dist: Record<string, number> = {};
    result.objects.forEach((o: any) => {
      const mat = o.material || "unknown";
      dist[mat] = (dist[mat] || 0) + 1;
    });
    result.material_distribution = dist;
  }
  return result;
}

export async function analyzeRoom(imageFile: File): Promise<AnalysisResult> {
  const url = getHfSpacesUrl();
  const formData = new FormData();
  formData.append("file", imageFile);

  const response = await fetch(`${url}/analyze`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Analysis failed: ${response.status} ${response.statusText}`);
  }

  const raw = await response.json();
  return normalizeResult(raw);
}

// Mock result for demo / when backend isn't connected
export function getMockResult(): AnalysisResult {
  return normalizeResult({
    aesthetic_score: 7.2,
    lighting: { brightness: 65 },
    objects: [
      { name: "sofa", confidence: 0.95, material: "fabric", distance_m: 2.3, source: "YOLO" },
      { name: "table", confidence: 0.89, material: "wood", distance_m: 1.8, source: "YOLO" },
      { name: "lamp", confidence: 0.82, material: "metal", distance_m: 3.1, source: "OWL-ViT" },
      { name: "rug", confidence: 0.78, material: "fabric", distance_m: 1.5, source: "OWL-ViT" },
      { name: "window", confidence: 0.91, material: "glass", distance_m: 4.0, source: "OWL-ViT" },
      { name: "cabinet", confidence: 0.85, material: "wood", distance_m: 2.7, source: "YOLO" },
    ],
    style_traits: {
      warm_lighting: 0.72,
      cool_lighting: 0.28,
      natural_light: 0.65,
      artificial_light: 0.45,
      soft_textures: 0.58,
      hard_surfaces: 0.42,
      organic_shapes: 0.55,
      geometric_shapes: 0.48,
    },
    possible_styles: ["Scandinavian", "Modern", "Minimalist", "Contemporary", "Mid-Century"],
    style_match_scores: {
      Scandinavian: 0.82,
      Modern: 0.71,
      Minimalist: 0.65,
      Contemporary: 0.58,
      "Mid-Century": 0.45,
    },
    depth_map: [],
    recommendations: [
      "Add a warm accent light near the reading area to improve lighting balance",
      "Consider a textured throw pillow to add visual depth to the sofa",
      "The color palette works well — consider adding a subtle accent color for visual interest",
      "Room has good spatial balance. A small plant could enhance the organic feel",
    ],
    design_metrics: {
      color_harmony: 7.5,
      contrast_balance: 6.8,
      lighting_quality: 7.2,
      light_temperature: 6.5,
      spatial_balance: 7.0,
      alignment_order: 6.9,
      negative_space: 7.3,
      visual_comfort: 7.1,
      clutter_control: 6.7,
      material_quality: 7.4,
      texture_depth: 6.6,
      design_cohesion: 7.2,
      visual_hierarchy: 6.8,
    },
  });
}
