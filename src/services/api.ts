// API service for HF Spaces and edge functions

const DEFAULT_HF_URL = "https://your-space.hf.space";

export function getHfSpacesUrl(): string {
  return localStorage.getItem("roomform_hf_url") || DEFAULT_HF_URL;
}

export function setHfSpacesUrl(url: string) {
  localStorage.setItem("roomform_hf_url", url);
}

export interface AnalysisResult {
  aesthetic_score: number;
  brightness: number;
  objects: Array<{
    label: string;
    confidence: number;
    material: string;
    distance: number;
    source: string;
    bbox: number[];
  }>;
  style_traits: Record<string, number>;
  top_styles: Array<{ style: string; score: number }>;
  design_metrics: Record<string, number>;
  material_distribution: Record<string, number>;
  recommendations: string[];
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

  return response.json();
}

// Mock result for demo / when HF Spaces isn't connected
export function getMockResult(): AnalysisResult {
  return {
    aesthetic_score: 7.2,
    brightness: 65,
    objects: [
      { label: "sofa", confidence: 0.95, material: "fabric", distance: 2.3, source: "YOLO", bbox: [100, 200, 400, 350] },
      { label: "table", confidence: 0.89, material: "wood", distance: 1.8, source: "YOLO", bbox: [300, 250, 500, 400] },
      { label: "lamp", confidence: 0.82, material: "metal", distance: 3.1, source: "OWL-ViT", bbox: [50, 100, 120, 250] },
      { label: "rug", confidence: 0.78, material: "fabric", distance: 1.5, source: "OWL-ViT", bbox: [150, 300, 450, 420] },
      { label: "window", confidence: 0.91, material: "glass", distance: 4.0, source: "OWL-ViT", bbox: [200, 50, 380, 200] },
      { label: "cabinet", confidence: 0.85, material: "wood", distance: 2.7, source: "YOLO", bbox: [420, 150, 550, 380] },
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
    top_styles: [
      { style: "Scandinavian", score: 0.82 },
      { style: "Modern", score: 0.71 },
      { style: "Minimalist", score: 0.65 },
      { style: "Contemporary", score: 0.58 },
      { style: "Mid-Century", score: 0.45 },
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
    material_distribution: {
      fabric: 35,
      wood: 28,
      metal: 15,
      glass: 12,
      plastic: 10,
    },
    recommendations: [
      "Add a warm accent light near the reading area to improve lighting balance",
      "Consider a textured throw pillow to add visual depth to the sofa",
      "The color palette works well — consider adding a subtle accent color for visual interest",
      "Room has good spatial balance. A small plant could enhance the organic feel",
    ],
  };
}
