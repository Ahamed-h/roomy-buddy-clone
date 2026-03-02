// Ollama local AI service (Qwen2.5-VL-3B via Ollama)

const DEFAULT_OLLAMA_URL = "http://localhost:11434";

export function getOllamaUrl(): string {
  return localStorage.getItem("aivo_ollama_url") || DEFAULT_OLLAMA_URL;
}

export function setOllamaUrl(url: string) {
  localStorage.setItem("aivo_ollama_url", url);
}

export function getOllamaModel(): string {
  return localStorage.getItem("aivo_ollama_model") || "qwen2.5-vl:3b";
}

export function setOllamaModel(model: string) {
  localStorage.setItem("aivo_ollama_model", model);
}

/** Check if Ollama is reachable */
export async function isOllamaAvailable(): Promise<boolean> {
  try {
    const resp = await fetch(getOllamaUrl(), { signal: AbortSignal.timeout(2000) });
    return resp.ok;
  } catch {
    return false;
  }
}

/** OpenAI-compatible chat completion via Ollama */
export async function ollamaChat(
  messages: Array<{ role: string; content: any }>,
  options?: { stream?: boolean }
): Promise<Response> {
  const url = `${getOllamaUrl()}/v1/chat/completions`;
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: getOllamaModel(),
      messages,
      stream: options?.stream ?? false,
    }),
  });
}

/** Send an image + prompt to Ollama for vision tasks */
export async function ollamaVision(
  prompt: string,
  imageBase64: string
): Promise<string> {
  const resp = await ollamaChat([
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: imageBase64 } },
      ],
    },
  ]);

  if (!resp.ok) throw new Error(`Ollama error: ${resp.status}`);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || "";
}

/** Streaming chat with Ollama — returns a ReadableStream */
export async function ollamaChatStream(
  messages: Array<{ role: string; content: any }>
): Promise<ReadableStream<Uint8Array> | null> {
  const resp = await ollamaChat(messages, { stream: true });
  if (!resp.ok) throw new Error(`Ollama stream error: ${resp.status}`);
  return resp.body;
}
