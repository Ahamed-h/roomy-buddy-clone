import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Upload, Send, Bot, User, TrendingUp, ThumbsUp, ThumbsDown } from "lucide-react";
import { getHfSpacesUrl } from "@/services/api";
import { supabase } from "@/integrations/supabase/client";

interface ChatMessage {
  role: "user" | "ai";
  content: string;
  imageUrl?: string;
}

const Design2DTab = () => {
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const API = getHfSpacesUrl();

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [currentImage, setCurrentImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [includeEvaluation, setIncludeEvaluation] = useState(true);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [evaluationResult, setEvaluationResult] = useState<any>(null);
  const [aestheticHistory, setAestheticHistory] = useState<number[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [awaitingFeedback, setAwaitingFeedback] = useState(false);
  const [pipelineStep, setPipelineStep] = useState<string | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chatHistory, isTyping]);

  useEffect(() => {
    setChatHistory([
      {
        role: "ai",
        content:
          "Hi! 👋 Let's redesign your space. Upload a room photo above and I'll:\n\n1. **Analyze** it locally (objects, style, layout)\n2. **Chat** with you to understand your vision\n3. **Generate** a redesigned room image\n\nUpload a photo to get started!",
      },
    ]);
  }, []);

  const addMessage = useCallback((role: "user" | "ai", content: string, imageUrl?: string) => {
    setChatHistory((prev) => [...prev, { role, content, imageUrl }]);
  }, []);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCurrentImage(file);
      setImagePreview(URL.createObjectURL(file));
      setGeneratedImageUrl(null);
      setEvaluationResult(null);
      setAwaitingFeedback(false);

      const b64 = await fileToBase64(file);
      setImageBase64(b64);

      addMessage("ai", "Great photo! Let me **analyze** your room first...");

      // Auto-run local analysis
      await runAnalysis(file);
    }
  };

  const runAnalysis = async (file?: File) => {
    const imageFile = file || currentImage;
    if (!imageFile) return;
    setIsAnalyzing(true);
    setPipelineStep("Analyzing room locally...");
    try {
      const fd = new FormData();
      fd.append("file", imageFile);
      const resp = await fetch(`${API}/analyze`, { method: "POST", body: fd });
      if (!resp.ok) throw new Error(`Analysis failed: ${resp.status}`);
      const data = await resp.json();
      setEvaluationResult(data);
      setAestheticHistory((prev) => [...prev, data.aesthetic_score]);

      const topStyles = data.possible_styles?.slice(0, 3).join(", ") || "mixed";
      const objectNames = data.objects?.map((o: any) => o.name || o.label).slice(0, 6).join(", ") || "none detected";

      addMessage(
        "ai",
        `✅ **Analysis complete!**\n\n` +
          `**Aesthetic Score:** ${data.aesthetic_score}/10\n` +
          `**Detected Style:** ${topStyles}\n` +
          `**Objects:** ${objectNames}\n` +
          `**Brightness:** ${data.lighting?.brightness ?? "N/A"}%\n\n` +
          `Now tell me — what style do you want? For example:\n` +
          `• "Make it modern and minimalist"\n` +
          `• "I want a cozy Scandinavian vibe"\n` +
          `• "Industrial with warm lighting"\n\n` +
          `Or just describe your dream room!`
      );
    } catch (err: any) {
      addMessage("ai", `⚠️ Local analysis unavailable (${err.message}). No worries — just describe the style you want and I'll generate a redesign directly!`);
    } finally {
      setIsAnalyzing(false);
      setPipelineStep(null);
    }
  };

  const buildSmartPrompt = async (userStyle: string): Promise<string> => {
    // Try local enhance_prompt first
    if (includeEvaluation && evaluationResult) {
      try {
        const resp = await fetch(`${API}/design/enhance_prompt`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ evaluation_json: evaluationResult, user_style: userStyle }),
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data.enhanced_prompt) return data.enhanced_prompt;
        }
      } catch {}
    }

    // Fallback: build prompt from evaluation context
    if (evaluationResult) {
      const styles = evaluationResult.possible_styles?.slice(0, 2).join(", ") || "";
      const objects = evaluationResult.objects?.map((o: any) => o.name).slice(0, 5).join(", ") || "";
      return `Redesign this room in a ${userStyle} style. Current room has: ${objects}. Current style leans ${styles}. Keep the same room layout but transform the aesthetic.`;
    }

    return `Redesign this room in a ${userStyle} style. Make it photorealistic and keep the room layout.`;
  };

  const generateRedesign = async (stylePrompt: string) => {
    if (!currentImage && !imageBase64) {
      addMessage("ai", "Please upload a room photo first!");
      return;
    }

    setIsGenerating(true);
    setAwaitingFeedback(false);
    setPipelineStep("Building smart prompt...");

    const enhancedPrompt = await buildSmartPrompt(stylePrompt);
    addMessage("ai", `🎨 Generating redesign with prompt:\n_"${enhancedPrompt.slice(0, 120)}..."_`);

    // Try local backend first
    setPipelineStep("Trying local image generation...");
    try {
      const fd = new FormData();
      fd.append("file", currentImage!);
      fd.append("style_prompt", enhancedPrompt);
      const resp = await fetch(`${API}/design/generate/2d/repaint`, { method: "POST", body: fd });
      if (resp.ok) {
        const data = await resp.json();
        if (data.image_url) {
          setGeneratedImageUrl(data.image_url);
          addMessage("ai", `Here's your redesign! 👇\n\nDo you like it?`, data.image_url);
          setAwaitingFeedback(true);
          setIsGenerating(false);
          setPipelineStep(null);
          return;
        }
      }
    } catch {}

    // Fallback: Lovable AI image generation
    setPipelineStep("Using AI image generation (cloud fallback)...");
    try {
      const b64 = imageBase64 || (currentImage ? await fileToBase64(currentImage) : null);
      const { data, error } = await supabase.functions.invoke("generate-image", {
        body: { prompt: enhancedPrompt, imageBase64: b64 },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.image_url) {
        setGeneratedImageUrl(data.image_url);
        addMessage("ai", `Here's your **AI-generated** redesign! 👇\n\n${data.description || ""}`, data.image_url);
        setAwaitingFeedback(true);
      } else {
        addMessage("ai", "❌ Image generation didn't produce a result. Try a different style description.");
      }
    } catch (err: any) {
      addMessage("ai", `❌ Image generation failed: ${err.message}. Try again or rephrase your style.`);
    } finally {
      setIsGenerating(false);
      setPipelineStep(null);
    }
  };

  const handleChatSubmit = async () => {
    const msg = inputMessage.trim();
    if (!msg) return;
    setInputMessage("");
    addMessage("user", msg);
    const lower = msg.toLowerCase();

    // "analyze" keyword
    if (lower.includes("analyze") || lower.includes("evaluate")) {
      await runAnalysis();
      return;
    }

    // Check if this looks like a redesign request (style description)
    const styleKeywords = ["modern", "scandinavian", "industrial", "minimalist", "boho", "contemporary", "rustic", "cozy", "elegant", "luxury", "vintage", "retro", "japanese", "zen", "tropical", "coastal", "farmhouse", "art deco", "mid-century"];
    const hasStyle = styleKeywords.some((s) => lower.includes(s));
    const isRedesignIntent = hasStyle || lower.includes("redesign") || lower.includes("generate") || lower.includes("make it") || lower.includes("transform") || lower.includes("change to") || lower.includes("i want");

    if (isRedesignIntent && currentImage) {
      await generateRedesign(msg);
      return;
    }

    if (isRedesignIntent && !currentImage) {
      addMessage("ai", "Please upload a room photo first! I need an image to redesign.");
      return;
    }

    // General chat — use Supabase edge function (Gemini)
    setIsTyping(true);
    try {
      const roomContext = evaluationResult || null;
      const { data: streamData, error } = await supabase.functions.invoke("design-chat", {
        body: {
          messages: [
            ...chatHistory
              .filter((m) => m.content)
              .map((m) => ({ role: m.role === "ai" ? "assistant" : "user", content: m.content })),
            { role: "user", content: msg },
          ],
          roomContext,
        },
      });

      if (error) throw error;

      let aiResponse = "";
      if (streamData instanceof ReadableStream) {
        const reader = streamData.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          for (const line of chunk.split("\n")) {
            if (line.startsWith("data: ") && line !== "data: [DONE]") {
              try {
                const json = JSON.parse(line.slice(6));
                const delta = json.choices?.[0]?.delta?.content;
                if (delta) aiResponse += delta;
              } catch {}
            }
          }
        }
      } else if (typeof streamData === "string") {
        aiResponse = streamData;
      } else if (streamData?.error) {
        throw new Error(streamData.error);
      }

      if (aiResponse) {
        addMessage("ai", aiResponse);
        const furnitureMatch = aiResponse.match(/```furniture\n([\s\S]*?)\n```/);
        if (furnitureMatch) {
          toast({ title: "Furniture suggestion detected!", description: "Open the 3D Studio to add it." });
        }
      } else {
        addMessage("ai", "I'm not sure how to help with that. Try describing a room style you'd like!");
      }
    } catch (err) {
      console.error("Chat error:", err);
      addMessage("ai", `Chat error: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsTyping(false);
    }
  };

  const handleFeedback = async (good: boolean) => {
    setAwaitingFeedback(false);
    if (good) {
      addMessage("user", "This looks great! 👍");
      const latest = aestheticHistory[aestheticHistory.length - 1];
      addMessage("ai", `Wonderful! 🎉${latest ? ` Aesthetic score: **${latest.toFixed(1)}/10**.` : ""}\n\nWant to try another style, or open in the 3D Studio?`);
    } else {
      addMessage("user", "Not quite right. 👎");
      addMessage("ai", "No problem! Tell me what to change — colors, furniture, lighting, materials? I'll generate a new version.");
    }
  };

  const renderSparkline = () => {
    if (aestheticHistory.length < 2) return null;
    const max = Math.max(...aestheticHistory, 10);
    const min = Math.min(...aestheticHistory, 0);
    const w = 120;
    const h = 32;
    const points = aestheticHistory
      .map((v, i) => {
        const x = (i / (aestheticHistory.length - 1)) * w;
        const y = h - ((v - min) / (max - min)) * h;
        return `${x},${y}`;
      })
      .join(" ");
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <TrendingUp className="h-3 w-3" />
        <svg width={w} height={h} className="overflow-visible">
          <polyline fill="none" stroke="hsl(var(--primary))" strokeWidth="2" points={points} />
          {aestheticHistory.map((v, i) => (
            <circle key={i} cx={(i / (aestheticHistory.length - 1)) * w} cy={h - ((v - min) / (max - min)) * h} r="3" fill="hsl(var(--primary))" />
          ))}
        </svg>
        <span>{aestheticHistory[aestheticHistory.length - 1]?.toFixed(1)}</span>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Top: Upload + Controls */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="glass-card-static">
          <CardContent className="p-4">
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-border/50 p-4 transition-all hover:border-primary/40 hover:bg-muted/20">
              {imagePreview ? (
                <img src={imagePreview} alt="Room" className="h-16 w-16 rounded-md object-cover" />
              ) : (
                <Upload className="h-8 w-8 text-muted-foreground" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{currentImage ? currentImage.name : "Upload room photo"}</p>
                <p className="text-xs text-muted-foreground">JPG / PNG, up to 10 MB</p>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </label>
          </CardContent>
        </Card>

        <Card className="glass-card-static">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex items-center gap-3 flex-1">
              <Switch id="include-eval" checked={includeEvaluation} onCheckedChange={setIncludeEvaluation} />
              <Label htmlFor="include-eval" className="text-sm font-medium text-foreground cursor-pointer">
                Smart prompt (use analysis)
              </Label>
              {!evaluationResult && includeEvaluation && (
                <span className="text-xs text-muted-foreground">(Upload to analyze)</span>
              )}
            </div>
            {renderSparkline()}
          </CardContent>
        </Card>
      </div>

      {/* Pipeline step indicator */}
      {pipelineStep && (
        <Card className="glass-card border-primary/20">
          <CardContent className="flex items-center gap-3 py-3 px-4">
            <div className="orange-spinner h-4 w-4" />
            <p className="text-xs font-medium text-muted-foreground">{pipelineStep}</p>
          </CardContent>
        </Card>
      )}

      {/* Chat Interface */}
      <Card className="flex flex-col glass-card-static" style={{ height: "480px" }}>
        <ScrollArea ref={scrollRef} className="flex-1 p-4">
          <div className="space-y-4">
            {chatHistory.map((msg, i) => (
              <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${msg.role === "ai" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                  {msg.role === "ai" ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                </div>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${msg.role === "ai" ? "rounded-tl-sm bg-muted/60 text-foreground backdrop-blur-sm" : "rounded-tr-sm bg-primary text-primary-foreground"}`}>
                  {msg.content.split("\n").map((line, j) => (
                    <p key={j} className={j > 0 ? "mt-1.5" : ""}>
                      {line.split(/(\*\*.*?\*\*)|(_.*?_)/).map((part, k) => {
                        if (!part) return null;
                        if (part.startsWith("**") && part.endsWith("**")) return <strong key={k}>{part.slice(2, -2)}</strong>;
                        if (part.startsWith("_") && part.endsWith("_")) return <em key={k}>{part.slice(1, -1)}</em>;
                        return <span key={k}>{part}</span>;
                      })}
                    </p>
                  ))}
                  {msg.imageUrl && (
                    <img src={msg.imageUrl} alt="Generated" className="mt-3 rounded-lg border border-border/30 max-h-80 object-contain" />
                  )}
                </div>
              </div>
            ))}

            {(isTyping || isAnalyzing || isGenerating) && (
              <div className="flex gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Bot className="h-3.5 w-3.5" />
                </div>
                <div className="rounded-2xl rounded-tl-sm bg-muted/60 px-4 py-3 backdrop-blur-sm">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-primary/50" style={{ animationDelay: "0ms" }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-primary/50" style={{ animationDelay: "150ms" }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-primary/50" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {awaitingFeedback && (
          <div className="flex items-center gap-2 border-t border-border/30 px-4 py-2.5">
            <span className="text-xs text-muted-foreground">Is this good?</span>
            <Button size="sm" variant="outline" className="gap-1.5 border-border/50 hover:border-primary/30" onClick={() => handleFeedback(true)}>
              <ThumbsUp className="h-3.5 w-3.5" /> Yes!
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 border-border/50 hover:border-primary/30" onClick={() => handleFeedback(false)}>
              <ThumbsDown className="h-3.5 w-3.5" /> Not yet
            </Button>
          </div>
        )}

        <div className="flex items-center gap-2 border-t border-border/30 p-3">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleChatSubmit()}
            placeholder="Describe your dream room style..."
            disabled={isGenerating || isAnalyzing}
            className="flex-1 bg-muted/30 border-border/50 focus:border-primary/50"
          />
          <Button
            size="icon"
            onClick={handleChatSubmit}
            disabled={!inputMessage.trim() || isGenerating || isAnalyzing}
            className="btn-premium h-9 w-9"
          >
            {isGenerating || isAnalyzing ? <div className="orange-spinner h-4 w-4" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </Card>

      {generatedImageUrl && (
        <Card className="glass-card-static overflow-hidden">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-foreground mb-3">Generated Design</p>
            <img src={generatedImageUrl} alt="Generated design" className="w-full rounded-lg" />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Design2DTab;
