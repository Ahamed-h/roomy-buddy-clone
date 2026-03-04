/**
 * Puter.js AI Image Generation Service
 * Free, unlimited image generation — no API keys needed.
 * Uses the global `puter` object loaded from https://js.puter.com/v2/
 */

declare global {
  interface Window {
    puter: {
      ai: {
        txt2img: (
          prompt: string,
          options?: { model?: string; quality?: string }
        ) => Promise<HTMLImageElement>;
      };
    };
  }
}

export type PuterModel =
  | "dall-e-3"
  | "flux-schnell"
  | "sdxl"
  | "gemini-2.5-flash-image-preview"
  | "gpt-image-1"
  | "gpt-image-1-mini"
  | "stabilityai/stable-diffusion-xl-base-1.0";

export const PUTER_MODELS: { value: PuterModel; label: string }[] = [
  { value: "dall-e-3", label: "DALL·E 3" },
  { value: "gpt-image-1", label: "GPT Image" },
  { value: "gemini-2.5-flash-image-preview", label: "Gemini Flash" },
  { value: "flux-schnell", label: "Flux Schnell" },
  { value: "stabilityai/stable-diffusion-xl-base-1.0", label: "SDXL" },
];

function getPuter() {
  if (!window.puter?.ai?.txt2img) {
    throw new Error("Puter.js not loaded. Check your internet connection.");
  }
  return window.puter;
}

/** Convert an HTMLImageElement to a base64 data URL */
function imgToDataUrl(img: HTMLImageElement): string {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL("image/png");
}

/**
 * Generate an image from a text prompt using Puter.js (free, no API key).
 * Returns a base64 data URL.
 */
export async function puterGenerateImage(
  prompt: string,
  model: PuterModel = "dall-e-3"
): Promise<string> {
  const puter = getPuter();
  const imgEl = await puter.ai.txt2img(prompt, { model });
  return imgToDataUrl(imgEl);
}
