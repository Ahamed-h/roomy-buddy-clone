// ==============================================================
// API service — routes all calls through Supabase edge functions
// (which proxy to Lovable AI Gateway)
// ==============================================================

import { supabase } from "@/integrations/supabase/client";

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
  image_url: string | null;
  description: string;
}

export interface ChatResult {
  response: string;
  action: string;
  style_prompt: string;
  suggested_style: string;
  image_url?: string | null;
  generation_error?: string;
  elapsed_s?: number;
}

export interface FloorPlanAnalysisResult {
  analysis: string;
  elapsed_s: number;
}

export interface FloorPlanGenerateResult {
  image_url: string | null;
  description: string;
}

// ==============================================================
// Helper — convert File to base64 data URL
// ==============================================================

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ==============================================================
// Style constants (matches main.py STYLE_PROMPTS)
// ==============================================================

const STYLE_PROMPTS: Record<string, string> = {
  minimalist: "minimalist interior, clean lines, neutral palette, uncluttered, calm atmosphere",
  luxury: "luxury interior, gold accents, marble surfaces, high-end furniture, chandeliers",
  scandinavian: "scandinavian interior, white walls, light wood, cozy textiles, hygge aesthetic",
  modern: "modern interior, sleek furniture, open plan, geometric shapes, neutral tones",
  industrial: "industrial interior, exposed brick, metal pipes, raw concrete, Edison bulbs",
  bohemian: "bohemian interior, colorful textiles, indoor plants, eclectic layered decor",
  mediterranean: "mediterranean interior, terracotta tiles, arched doorways, blue and white palette",
  japandi: "japandi interior, wabi-sabi, natural materials, muted earth tones, zen simplicity",
};

export function getStyles(): { styles: string[] } {
  return { styles: Object.keys(STYLE_PROMPTS) };
}

// ==============================================================
// Room Analysis — via gemini-ai vision
// ==============================================================

export async function analyzeRoom(imageFile: File): Promise<AnalysisResult> {
  const imageBase64 = await fileToBase64(imageFile);

  const prompt = `You are an expert interior designer analyzing a room photo. Analyze this room image and return ONLY valid JSON with this exact schema:
{
  "objects": [{"name": "sofa", "confidence": 0.95, "bbox": [], "material": "fabric", "source": "AI"}],
  "lighting": {"brightness": 0.65, "natural_light": true, "warm_tone": true, "saturation": 0.45},
  "aesthetic_score": 7.2,
  "design_metrics": {},
  "recommendations": ["Add layered lighting for better ambiance"],
  "style_traits": {"lighting": "warm", "palette": "muted", "density": "balanced", "texture": "mixed", "geometry": "mixed", "contrast": "medium"},
  "possible_styles": ["modern", "scandinavian"],
  "style_match_scores": {"modern": 0.71, "scandinavian": 0.82},
  "color_palette": ["beige", "white", "oak wood"],
  "best_style_upgrade": "scandinavian",
  "ai_summary": "A moderately styled modern living room with good natural light."
}

Rules:
- aesthetic_score is 0-10
- confidence is 0-1
- style_match_scores values are 0-1
- brightness is 0-1
- Identify ALL visible furniture/objects
- Give 3-5 specific actionable recommendations
- Return ONLY JSON, no markdown`;

  const { data, error } = await supabase.functions.invoke("gemini-ai", {
    body: { action: "vision", prompt, imageBase64 },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  const rawText = data.text || "{}";
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

  // Ensure required fields exist
  const result: AnalysisResult = {
    objects: parsed.objects || [],
    lighting: parsed.lighting || { brightness: 0.5, natural_light: true, warm_tone: true, saturation: 0.4 },
    aesthetic_score: parsed.aesthetic_score ?? 5,
    design_metrics: parsed.design_metrics || {},
    recommendations: parsed.recommendations || [],
    style_traits: parsed.style_traits || {},
    possible_styles: parsed.possible_styles || [],
    style_match_scores: parsed.style_match_scores || {},
    color_palette: parsed.color_palette || [],
    best_style_upgrade: parsed.best_style_upgrade || "",
    ai_summary: parsed.ai_summary || "",
    analysis_source: "lovable-ai",
  };

  // Build legacy fields
  result.brightness = Math.round((result.lighting.brightness ?? 0.5) * 100);
  if (result.style_match_scores) {
    result.top_styles = Object.entries(result.style_match_scores)
      .map(([style, score]) => ({ style, score: score as number }))
      .sort((a, b) => b.score - a.score);
  }

  return result;
}

// ==============================================================
// Design Repaint — via gemini-ai generate-image
// ==============================================================

export async function repaintRoom(
  imageFile: File,
  prompt: string,
  style = "modern",
): Promise<GenerationResult> {
  const imageBase64 = await fileToBase64(imageFile);
  const styleTag = STYLE_PROMPTS[style] || STYLE_PROMPTS.modern;
  const fullPrompt = `Redesign this room: ${prompt}. Style: ${styleTag}. Photorealistic interior design photography, 4k, high detail, professional lighting, wide angle lens.`;

  const { data, error } = await supabase.functions.invoke("gemini-ai", {
    body: { action: "generate-image", prompt: fullPrompt, imageBase64 },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return { image_url: data.image_url || null, description: data.description || "" };
}

// ==============================================================
// Design Generate (text only) — via gemini-ai generate-image
// ==============================================================

export async function generateRoom(
  prompt: string,
  style = "modern",
): Promise<GenerationResult> {
  const styleTag = STYLE_PROMPTS[style] || STYLE_PROMPTS.modern;
  const fullPrompt = `Interior design photography: ${prompt}. ${styleTag}. Photorealistic, 4k, high detail, professional lighting, wide angle lens.`;

  const { data, error } = await supabase.functions.invoke("gemini-ai", {
    body: { action: "generate-image", prompt: fullPrompt },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return { image_url: data.image_url || null, description: data.description || "" };
}

// ==============================================================
// Design Chat — via gemini-ai chat
// ==============================================================

export async function designChat(
  message: string,
  _sessionId = "default",
  _includeAnalysis = false,
  _analysisJson = "",
  conversationHistory?: { role: string; content: string }[],
  imageBase64?: string,
): Promise<ChatResult> {
  const wantsGenerate = /\bgenerate\b/i.test(message);

  const systemPrompt = wantsGenerate
    ? `You are an expert AI interior design assistant. The user wants to generate a redesigned room image.
Review the ENTIRE conversation history to understand what style, mood, colors, furniture, and changes the user wants.
Synthesize all their requests into ONE comprehensive design prompt.
Always respond with valid JSON:
{
  "response": "Brief description of what you're generating",
  "action": "generate",
  "style_prompt": "Detailed, comprehensive prompt synthesizing ALL conversation requirements for image generation. Include style, colors, furniture, mood, lighting, materials mentioned across the conversation.",
  "suggested_style": "one of: minimalist, luxury, scandinavian, modern, industrial, bohemian, mediterranean, japandi"
}`
    : `You are an expert AI interior design assistant for the Roomy Buddy app.
You help users explore interior design ideas through conversation. Ask clarifying questions about their preferences — style, colors, mood, furniture, lighting, materials.
Build a clear picture of what they want before they say "generate".
Always respond with valid JSON:
{
  "response": "Your helpful design advice and questions here",
  "action": "none",
  "style_prompt": "",
  "suggested_style": ""
}`;

  // Use full conversation history if provided, otherwise just the single message
  const messages = conversationHistory || [{ role: "user", content: message }];

  // If generating with image, use generate-image action directly
  if (wantsGenerate && imageBase64) {
    // First get the synthesized prompt from chat
    const { data: chatData, error: chatError } = await supabase.functions.invoke("gemini-ai", {
      body: { action: "chat", messages, systemPrompt },
    });
    if (chatError) throw chatError;
    if (chatData?.error) throw new Error(chatData.error);

    const rawText = chatData.text || "";
    let stylePrompt = message;
    let response = "Here's your redesign!";
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        stylePrompt = parsed.style_prompt || message;
        response = parsed.response || response;
      }
    } catch { /* use defaults */ }

    // Now generate image with the synthesized prompt + original photo
    const genPrompt = `Redesign this room based on these requirements: ${stylePrompt}. Keep the same room layout and perspective. Photorealistic interior design, professional photography, 4K quality.`;

    const { data: genData, error: genError } = await supabase.functions.invoke("gemini-ai", {
      body: { action: "generate-image", prompt: genPrompt, imageBase64 },
    });
    if (genError) throw genError;
    if (genData?.error) throw new Error(genData.error);

    return {
      response,
      action: "generate",
      image_url: genData.image_url || null,
      style_prompt: stylePrompt,
      suggested_style: "modern",
    };
  }

  const { data, error } = await supabase.functions.invoke("gemini-ai", {
    body: { action: "chat", messages, systemPrompt },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  const rawText = data.text || "";

  // Try to parse as JSON
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        response: parsed.response || parsed.reply || rawText,
        action: parsed.action || "none",
        style_prompt: parsed.style_prompt || "",
        suggested_style: parsed.suggested_style || "modern",
      };
    }
  } catch {
    // Not JSON, return as plain text
  }

  return {
    response: rawText,
    action: "none",
    style_prompt: "",
    suggested_style: "modern",
  };
}

// ==============================================================
// Enhance Prompt — via gemini-ai chat
// ==============================================================

export async function enhancePrompt(
  userStyle: string,
  evaluationJson = "{}",
): Promise<{ enhanced_prompt: string }> {
  const { data, error } = await supabase.functions.invoke("gemini-ai", {
    body: {
      action: "chat",
      messages: [{
        role: "user",
        content: `Generate an optimized Stable Diffusion prompt for: "${userStyle}". Context: ${evaluationJson}. Return ONLY the prompt string, max 100 words.`,
      }],
      systemPrompt: "You are a prompt engineer specializing in interior design image generation. Return ONLY the optimized prompt, no explanation.",
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return { enhanced_prompt: data.text || `${userStyle} interior, photorealistic, professional lighting, 4k` };
}

// ==============================================================
// Floor Plan Analysis — via analyze-floorplan edge function
// ==============================================================

export async function analyzeFloorplan(
  imageFile: File,
  _question?: string,
): Promise<FloorPlanAnalysisResult> {
  const imageBase64 = await fileToBase64(imageFile);

  const { data, error } = await supabase.functions.invoke("analyze-floorplan", {
    body: { imageBase64, format: "floorplan-analysis" },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  // The edge function returns FloorPlanAnalysis directly
  return { analysis: JSON.stringify(data), elapsed_s: 0 };
}

// ==============================================================
// Floor Plan Generate Room — via generate-floorplan edge function
// ==============================================================

export async function generateFloorplanRoom(
  imageFile: File,
  room = "living room",
  style = "modern",
): Promise<FloorPlanGenerateResult> {
  const imageBase64 = await fileToBase64(imageFile);

  const { data, error } = await supabase.functions.invoke("generate-floorplan", {
    body: {
      analysisData: { rooms: [{ label: room, estimatedSqFt: 200 }], totalArea: 1000, score: 7 },
      aiSuggestions: [],
      userSuggestions: `Focus on the ${room} in ${style} style`,
      imageBase64,
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return { image_url: data.image_url || null, description: data.description || "" };
}

// ==============================================================
// Mock data for demo / offline
// ==============================================================

export function getMockResult(): AnalysisResult {
  return {
    aesthetic_score: 7.2,
    lighting: { brightness: 0.65, natural_light: true, warm_tone: true, saturation: 0.45 },
    brightness: 65,
    objects: [
      { name: "sofa", confidence: 0.95, bbox: [], material: "fabric", source: "AI" },
      { name: "table", confidence: 0.89, bbox: [], material: "wood", source: "AI" },
      { name: "lamp", confidence: 0.82, bbox: [], material: "metal", source: "AI" },
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
