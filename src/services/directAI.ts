// Direct AI API calls (bypasses Supabase edge functions)
// Used when Supabase is inaccessible (e.g. regional blocks)

function getGeminiKey(): string | null {
  return localStorage.getItem("aivo_gemini_key");
}

function getOpenAIKey(): string | null {
  return localStorage.getItem("aivo_openai_key");
}

export function setGeminiKey(key: string) {
  localStorage.setItem("aivo_gemini_key", key);
}

export function setOpenAIKey(key: string) {
  localStorage.setItem("aivo_openai_key", key);
}

export function hasDirectKeys(): boolean {
  return !!(getGeminiKey() || getOpenAIKey());
}

/** Direct chat completion — Gemini first, OpenAI fallback */
export async function directChat(
  messages: Array<{ role: string; content: string }>,
  systemPrompt?: string
): Promise<string> {
  const geminiKey = getGeminiKey();
  const openaiKey = getOpenAIKey();

  // Try Gemini
  if (geminiKey) {
    try {
      const contents = messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
      if (systemPrompt) {
        contents.unshift({ role: "user", parts: [{ text: systemPrompt }] });
        contents.splice(1, 0, { role: "model", parts: [{ text: "Understood." }] });
      }

      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents }),
        }
      );
      if (resp.ok) {
        const data = await resp.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      }
    } catch (err) {
      console.warn("Direct Gemini chat failed:", err);
    }
  }

  // Try OpenAI
  if (openaiKey) {
    try {
      const msgs = systemPrompt
        ? [{ role: "system", content: systemPrompt }, ...messages]
        : messages;
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: "gpt-4o-mini", messages: msgs }),
      });
      if (resp.ok) {
        const data = await resp.json();
        return data.choices?.[0]?.message?.content || "";
      }
    } catch (err) {
      console.warn("Direct OpenAI chat failed:", err);
    }
  }

  throw new Error("No direct AI keys configured. Go to settings to add your Gemini or OpenAI API key.");
}

/** Direct vision analysis — Gemini with image */
export async function directVision(prompt: string, imageBase64: string): Promise<string> {
  const geminiKey = getGeminiKey();
  if (geminiKey) {
    try {
      const mimeMatch = imageBase64.match(/^data:(image\/[^;]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
      const rawBase64 = imageBase64.replace(/^data:image\/[^;]+;base64,/, "");

      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType, data: rawBase64 } },
              ],
            }],
          }),
        }
      );
      if (resp.ok) {
        const data = await resp.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      }
    } catch (err) {
      console.warn("Direct Gemini vision failed:", err);
    }
  }

  throw new Error("No Gemini API key configured for vision tasks.");
}

/** Direct image generation — Gemini image model, then DALL-E */
export async function directGenerateImage(
  prompt: string,
  imageBase64?: string | null
): Promise<{ image_url?: string; description?: string }> {
  const geminiKey = getGeminiKey();
  const openaiKey = getOpenAIKey();

  // Try Gemini image generation
  if (geminiKey) {
    try {
      const parts: any[] = [
        { text: `Redesign this room: ${prompt}. Keep layout, transform style. Photorealistic.` },
      ];
      if (imageBase64) {
        const mimeMatch = imageBase64.match(/^data:(image\/[^;]+);base64,/);
        const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
        const rawBase64 = imageBase64.replace(/^data:image\/[^;]+;base64,/, "");
        parts.push({ inline_data: { mime_type: mimeType, data: rawBase64 } });
      }

      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
          }),
        }
      );
      if (resp.ok) {
        const data = await resp.json();
        const resParts = data.candidates?.[0]?.content?.parts || [];
        for (const part of resParts) {
          if (part.inline_data) {
            const imgUrl = `data:${part.inline_data.mime_type};base64,${part.inline_data.data}`;
            return { image_url: imgUrl, description: "Generated with Gemini" };
          }
        }
        const textPart = resParts.find((p: any) => p.text);
        if (textPart) return { description: textPart.text };
      }
    } catch (err) {
      console.warn("Direct Gemini image gen failed:", err);
    }
  }

  // Try DALL-E
  if (openaiKey) {
    try {
      const resp = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt: `Interior design: ${prompt}. Photorealistic room redesign.`,
          n: 1,
          size: "1024x1024",
          response_format: "b64_json",
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const b64 = data.data?.[0]?.b64_json;
        if (b64) {
          return { image_url: `data:image/png;base64,${b64}`, description: "Generated with DALL-E 3" };
        }
      }
    } catch (err) {
      console.warn("Direct DALL-E failed:", err);
    }
  }

  throw new Error("Image generation failed. Check your API keys.");
}
