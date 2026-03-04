import { supabase } from "@/integrations/supabase/client";

/** Generate or edit an image using Gemini via edge function */
export async function geminiGenerateImage(
  prompt: string,
  imageBase64?: string | null
): Promise<{ image_url: string | null; description: string }> {
  const { data, error } = await supabase.functions.invoke("gemini-ai", {
    body: { action: "generate-image", prompt, imageBase64 },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return { image_url: data.image_url || null, description: data.description || "" };
}

/** Analyze an image with a text prompt using Gemini vision */
export async function geminiVision(
  prompt: string,
  imageBase64: string
): Promise<string> {
  const { data, error } = await supabase.functions.invoke("gemini-ai", {
    body: { action: "vision", prompt, imageBase64 },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.text || "";
}

/** Chat with Gemini */
export async function geminiChat(
  messages: Array<{ role: string; content: string }>,
  systemPrompt?: string
): Promise<string> {
  const { data, error } = await supabase.functions.invoke("gemini-ai", {
    body: { action: "chat", messages, systemPrompt },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.text || "";
}
