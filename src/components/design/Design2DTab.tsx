import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Upload, Wand2, Download, Loader2, CheckCircle2, Send, Bot, User, Save } from "lucide-react";
import { getHfSpacesUrl } from "@/services/api";
import { isOllamaAvailable, ollamaChatStream } from "@/services/ollama";
import { supabase } from "@/integrations/supabase/client";
import { saveDesign } from "@/lib/designs";
import { directChat, directVision, directGenerateImage, hasDirectKeys } from "@/services/directAI";
import { cn } from "@/lib/utils";

const ROOM_TYPES = ["Bedroom", "Living Room", "Kitchen", "Bathroom", "Dining Room", "Office", "Kids Room"];

const THEMES = [
  { id: "modern", label: "Modern" },
  { id: "minimalist", label: "Minimalist" },
  { id: "scandinavian", label: "Scandinavian" },
  { id: "industrial", label: "Industrial" },
  { id: "tropical", label: "Tropical" },
  { id: "coastal", label: "Coastal" },
  { id: "vintage", label: "Vintage" },
  { id: "boho", label: "Boho" },
  { id: "japanese", label: "Japanese" },
  { id: "art-deco", label: "Art Deco" },
  { id: "rustic", label: "Rustic" },
  { id: "tribal", label: "Tribal" },
];

const MAX_THEMES = 4;

interface ChatMessage {
  role: "user" | "ai";
  content: string;
  imageUrl?: string;
}

const Design2DTab = () => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const API = getHfSpacesUrl();

  const [currentImage, setCurrentImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [roomType, setRoomType] = useState("Bedroom");
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [generatedLabel, setGeneratedLabel] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [includeEvaluation, setIncludeEvaluation] = useState(true);
  const [pipelineStep, setPipelineStep] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Chat state
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { role: "ai", content: "Hi! 👋 Upload a room photo and select your preferred themes. I can help you refine your style or modify the generated design — just tell me what you'd like to change!" },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chatHistory, isTyping]);

  const addMessage = useCallback((role: "user" | "ai", content: string, imageUrl?: string) => {
    setChatHistory((prev) => [...prev, { role, content, imageUrl }]);
  }, []);

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCurrentImage(file);
    setImagePreview(URL.createObjectURL(file));
    setGeneratedImageUrl(null);
    setGeneratedLabel("");
    setAnalysisResult(null);

    const b64 = await fileToBase64(file);
    setImageBase64(b64);

    addMessage("ai", "Great photo! Analyzing your room...");
    await runAnalysis(file);
  };

  const runAnalysis = async (file: File) => {
    setIsAnalyzing(true);
    setPipelineStep("Analyzing room...");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const resp = await fetch(`${API}/analyze`, { method: "POST", body: fd });
      if (!resp.ok) throw new Error(`${resp.status}`);
      const data = await resp.json();
      setAnalysisResult(data);

      setPipelineStep("AI verifying results...");
      let verifiedData = data;
      try {
        const b64 = await fileToBase64(file);
        
        // Try Ollama first for verification
        const ollamaOnline = await isOllamaAvailable();
        if (ollamaOnline) {
          try {
            const { ollamaVision } = await import("@/services/ollama");
            const prompt = `You are an interior design AI verifier. Cross-check these ML results against the photo. Return corrected JSON with: aesthetic_score, lighting.brightness, objects, style_match_scores, possible_styles, recommendations.\n\nML Results:\n${JSON.stringify(data, null, 2)}`;
            const raw = await ollamaVision(prompt, b64);
            const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
            const jsonStr = jsonMatch ? jsonMatch[1].trim() : raw.trim();
            const verified = JSON.parse(jsonStr);
            if (verified) { verifiedData = { ...data, ...verified }; setAnalysisResult(verifiedData); }
          } catch (err) {
            console.warn("Ollama verify failed, trying next:", err);
          }
        }

        // Try direct API if not yet verified
        if (verifiedData === data && hasDirectKeys()) {
          try {
            const verifyPrompt = `You are an interior design AI verifier. Cross-check these ML results against the photo. Return corrected JSON with: aesthetic_score, lighting.brightness, objects, style_match_scores, possible_styles, recommendations.\n\nML Results:\n${JSON.stringify(data, null, 2)}`;
            const raw = await directVision(verifyPrompt, b64);
            const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
            const jsonStr = jsonMatch ? jsonMatch[1].trim() : raw.trim();
            const verified = JSON.parse(jsonStr);
            if (verified) { verifiedData = { ...data, ...verified }; setAnalysisResult(verifiedData); }
          } catch (err) {
            console.warn("Direct API verify failed, trying Supabase:", err);
          }
        }

        // Fallback to edge function if still not verified
        if (verifiedData === data) {
          const { data: verified, error } = await supabase.functions.invoke("verify-analysis", {
            body: { analysisResult: data, imageBase64: b64 },
          });
          if (!error && verified && !verified.error) {
            verifiedData = { ...data, ...verified };
            setAnalysisResult(verifiedData);
          }
        }
      } catch (err) {
        console.warn("AI verification failed:", err);
      }

      const topStyles = verifiedData.possible_styles?.slice(0, 3).join(", ") || "mixed";
      const objectNames = verifiedData.objects?.map((o: any) => o.name || o.label).slice(0, 6).join(", ") || "none detected";
      const verified = verifiedData !== data;
      addMessage("ai", `✅ **Analysis complete${verified ? " & AI verified" : ""}!**\n\n**Style:** ${topStyles}\n**Objects:** ${objectNames}\n**Score:** ${verifiedData.aesthetic_score}/10\n\nSelect themes and click Redesign, or tell me what changes you'd like!`);
    } catch {
      addMessage("ai", "⚠️ Analysis unavailable — select themes and I'll generate a redesign directly.");
    } finally {
      setIsAnalyzing(false);
      setPipelineStep(null);
    }
  };

  const toggleTheme = useCallback((id: string) => {
    setSelectedThemes((prev) => {
      if (prev.includes(id)) return prev.filter((t) => t !== id);
      if (prev.length >= MAX_THEMES) return prev;
      return [...prev, id];
    });
  }, []);

  const buildSmartPrompt = async (extraNotes: string = ""): Promise<string> => {
    const themeStr = selectedThemes.map((id) => THEMES.find((t) => t.id === id)?.label).filter(Boolean).join(", ");
    const userStyle = `${themeStr} style ${roomType.toLowerCase()}${extraNotes ? `. User notes: ${extraNotes}` : ""}`;

    if (includeEvaluation && analysisResult) {
      try {
        const resp = await fetch(`${API}/design/enhance_prompt`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ evaluation_json: analysisResult, user_style: userStyle }),
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data.enhanced_prompt) return data.enhanced_prompt;
        }
      } catch {}

      const objects = analysisResult.objects?.map((o: any) => o.name).slice(0, 5).join(", ") || "";
      return `Redesign this ${roomType.toLowerCase()} in a ${themeStr} style. ${extraNotes ? extraNotes + ". " : ""}Current objects: ${objects}. Keep room layout, transform the aesthetic. Photorealistic.`;
    }

    return `Redesign this ${roomType.toLowerCase()} in a ${themeStr} style. ${extraNotes ? extraNotes + ". " : ""}Make it photorealistic and keep the room layout.`;
  };

  const generateImage = async (extraNotes: string = "") => {
    if (!currentImage) {
      toast({ title: "Upload a photo first" });
      return;
    }

    setIsGenerating(true);
    const themeLabel = selectedThemes.map((id) => THEMES.find((t) => t.id === id)?.label).join(" + ") || "Custom";
    setGeneratedLabel(`${themeLabel} ${roomType}`);

    setPipelineStep("Building smart prompt...");

    try {
      const prompt = await buildSmartPrompt(extraNotes);

      // Try ComfyUI first (fully local, unlimited)
      setPipelineStep("Generating (ComfyUI local)...");
      try {
        const fd = new FormData();
        fd.append("file", currentImage);
        fd.append("style_prompt", prompt);
        const resp = await fetch(`${API}/design/generate/2d/comfyui`, { method: "POST", body: fd });
        if (resp.ok) {
          const data = await resp.json();
          if (data.image_url) {
            setGeneratedImageUrl(data.image_url);
            addMessage("ai", "Here's your redesign via **ComfyUI** (local)! 👇 Tell me if you'd like any changes.", data.image_url);
            return;
          }
        }
      } catch {
        console.log("ComfyUI /comfyui endpoint unavailable, trying /repaint...");
      }

      // Try local repaint fallback
      setPipelineStep("Generating (local repaint)...");
      try {
        const fd = new FormData();
        fd.append("file", currentImage);
        fd.append("style_prompt", prompt);
        const resp = await fetch(`${API}/design/generate/2d/repaint`, { method: "POST", body: fd });
        if (resp.ok) {
          const data = await resp.json();
          if (data.image_url) {
            setGeneratedImageUrl(data.image_url);
            addMessage("ai", "Here's your redesign! 👇 Tell me if you'd like any changes.", data.image_url);
            return;
          }
        }
      } catch {}

      addMessage("ai", "❌ Image generation requires **ComfyUI** running locally at `localhost:8188` and the FastAPI backend at `localhost:8000`.\n\nSee SETUP.md for instructions.");
    } catch (err: any) {
      addMessage("ai", `❌ Generation failed: ${err.message}`);
    } finally {
      setIsGenerating(false);
      setPipelineStep(null);
    }
  };

  const handleGenerate = async () => {
    if (!currentImage || selectedThemes.length === 0) {
      toast({ title: "Upload a photo and select at least one theme" });
      return;
    }
    const userNotes = chatHistory.filter((m) => m.role === "user").map((m) => m.content).slice(-3).join("; ");
    addMessage("ai", "🎨 Generating your redesign...");
    await generateImage(userNotes);
  };

  const handleChatSubmit = async () => {
    const msg = inputMessage.trim();
    if (!msg) return;
    setInputMessage("");
    addMessage("user", msg);

    // Detect if the user wants to modify the image
    const isModifyRequest = generatedImageUrl && /change|modify|make it|add|remove|replace|more|less|darker|lighter|brighter|warmer|cooler|different|try|redo|update|swap|put|move|adjust/i.test(msg);

    if (isModifyRequest && currentImage) {
      // Regenerate with the user's instruction as extra context
      addMessage("ai", "🎨 Updating your design based on your feedback...");
      await generateImage(msg);
      return;
    }

    // Otherwise use Ollama (local) first, then edge function for chat
    setIsTyping(true);
    try {
      const chatMessages = [
        ...chatHistory.filter((m) => m.content).map((m) => ({ role: m.role === "ai" ? "assistant" : "user", content: m.content })),
        { role: "user", content: msg },
      ];

      // Always pass analysis context to edge function for grounded responses
      const roomContext = analysisResult || null;

      // Build grounded system prompt for local/direct fallbacks
      const groundedSystemPrompt = roomContext
        ? `You are an expert interior designer assistant. The room has these detected objects: ${roomContext.objects?.slice(0, 5).map((o: any) => `${o.name || o.label}(${o.material || 'unknown'})`).join(", ") || "none"}. Style: ${roomContext.possible_styles?.slice(0, 2).join(", ") || "unknown"}. Aesthetic score: ${roomContext.aesthetic_score || "N/A"}/10. Reference these facts in your response. Be specific and actionable.`
        : "You are an expert interior designer assistant. Help users with room design, furniture selection, color palettes, and style advice. Be specific and actionable.";

      // Try Ollama first
      const ollamaOnline = await isOllamaAvailable();
      if (ollamaOnline) {
        try {
          const ollamaMessages = [{ role: "system", content: groundedSystemPrompt }, ...chatMessages];
          const stream = await ollamaChatStream(ollamaMessages);
          if (stream) {
            const reader = stream.getReader();
            const decoder = new TextDecoder();
            let aiResponse = "";
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
            if (aiResponse) {
              addMessage("ai", aiResponse);
              return;
            }
          }
        } catch (err) {
          console.warn("Ollama chat failed, falling back to cloud:", err);
        }
      }

      // Try direct API
      if (hasDirectKeys()) {
        try {
          const directResponse = await directChat(chatMessages, groundedSystemPrompt);
          if (directResponse) {
            addMessage("ai", directResponse);
            return;
          }
        } catch (err) {
          console.warn("Direct API chat failed, trying Supabase:", err);
        }
      }

      // Fallback to edge function (roomContext already declared above)
      const { data: streamData, error } = await supabase.functions.invoke("design-chat", {
        body: { messages: chatMessages, roomContext },
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

      addMessage("ai", aiResponse || "I'm not sure how to help with that. Try describing what you'd like!");
    } catch (err) {
      addMessage("ai", `Chat error: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsTyping(false);
    }
  };

  const handleDownload = () => {
    if (!generatedImageUrl) return;
    const a = document.createElement("a");
    a.href = generatedImageUrl;
    a.download = `redesign-${Date.now()}.png`;
    a.click();
  };

  const handleSave = async () => {
    if (!generatedImageUrl) return;
    setIsSaving(true);
    try {
      const themeLabel = selectedThemes.map((id) => THEMES.find((t) => t.id === id)?.label).join(" + ") || "Custom";
      await saveDesign({
        type: "2d",
        name: `${themeLabel} ${roomType}`,
        thumbnail_url: generatedImageUrl,
        data: {
          roomType,
          themes: selectedThemes,
          generatedImageUrl,
          originalImagePreview: imagePreview,
          analysisResult: includeEvaluation ? analysisResult : null,
        },
      });
      toast({ title: "Design saved!", description: "You can find it in your dashboard." });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      {/* ── Left Sidebar ── */}
      <div className="space-y-4">
        {/* Upload */}
        <Card className="glass-card-static">
          <CardContent className="p-4 space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Upload a photo of your room</Label>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-border/50 p-3 transition-all hover:border-primary/40 hover:bg-muted/20">
              {imagePreview ? (
                <img src={imagePreview} alt="Room" className="h-20 w-full rounded-md object-cover" />
              ) : (
                <div className="flex w-full flex-col items-center gap-1 py-4">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">JPG / PNG, up to 10 MB</span>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </label>
            {isAnalyzing && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Analyzing...
              </div>
            )}
            {analysisResult && !isAnalyzing && (
              <div className="flex items-center gap-2 text-xs text-primary">
                <CheckCircle2 className="h-3 w-3" /> Room analyzed
              </div>
            )}
          </CardContent>
        </Card>

        {/* Room Type */}
        <Card className="glass-card-static">
          <CardContent className="p-4 space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Select Room Type</Label>
            <Select value={roomType} onValueChange={setRoomType}>
              <SelectTrigger className="bg-muted/30 border-border/50"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROOM_TYPES.map((r) => (<SelectItem key={r} value={r}>{r}</SelectItem>))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Add Evaluation Result toggle */}
        <Card className="glass-card-static">
          <CardContent className="flex items-center gap-3 p-4">
            <Switch id="include-eval" checked={includeEvaluation} onCheckedChange={setIncludeEvaluation} />
            <Label htmlFor="include-eval" className="text-sm font-medium text-foreground cursor-pointer">
              Add evaluation result?
            </Label>
            {!analysisResult && includeEvaluation && (
              <span className="text-[10px] text-muted-foreground ml-auto">(Upload to analyze)</span>
            )}
          </CardContent>
        </Card>

        {/* Themes */}
        <Card className="glass-card-static">
          <CardContent className="p-4 space-y-3">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Select Room Themes (up to {MAX_THEMES})</Label>
            <div className="grid grid-cols-3 gap-2">
              {THEMES.map((theme) => {
                const selected = selectedThemes.includes(theme.id);
                const disabled = !selected && selectedThemes.length >= MAX_THEMES;
                return (
                  <button
                    key={theme.id}
                    onClick={() => toggleTheme(theme.id)}
                    disabled={disabled}
                    className={cn(
                      "rounded-lg border px-2 py-2 text-xs font-medium transition-all",
                      selected ? "border-primary bg-primary/15 text-primary" : "border-border/50 bg-muted/20 text-muted-foreground hover:border-primary/30 hover:bg-muted/40",
                      disabled && "opacity-40 cursor-not-allowed"
                    )}
                  >
                    {theme.label}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Generate */}
        <Button
          onClick={handleGenerate}
          disabled={!currentImage || selectedThemes.length === 0 || isGenerating}
          className="w-full btn-premium gap-2"
          size="lg"
        >
          {isGenerating ? (
            <><Loader2 className="h-4 w-4 animate-spin" />{pipelineStep || "Generating..."}</>
          ) : (
            <><Wand2 className="h-4 w-4" /> Redesign room</>
          )}
        </Button>
      </div>

      {/* ── Right Panel ── */}
      <div className="flex flex-col gap-4">
        {/* Style Assistant (moved up) */}
        <Card className="glass-card-static flex flex-col" style={{ height: "280px" }}>
          <div className="px-4 py-2.5 border-b border-border/30">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">💬 Style Assistant — describe changes to regenerate</p>
          </div>
          <ScrollArea ref={scrollRef} className="flex-1 p-3">
            <div className="space-y-3">
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${msg.role === "ai" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                    {msg.role === "ai" ? <Bot className="h-3 w-3" /> : <User className="h-3 w-3" />}
                  </div>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${msg.role === "ai" ? "rounded-tl-sm bg-muted/60 text-foreground" : "rounded-tr-sm bg-primary text-primary-foreground"}`}>
                    {msg.content.split("\n").map((line, j) => (
                      <p key={j} className={j > 0 ? "mt-1" : ""}>
                        {line.split(/(\*\*.*?\*\*)/).map((part, k) => {
                          if (!part) return null;
                          if (part.startsWith("**") && part.endsWith("**")) return <strong key={k}>{part.slice(2, -2)}</strong>;
                          return <span key={k}>{part}</span>;
                        })}
                      </p>
                    ))}
                    {msg.imageUrl && <img src={msg.imageUrl} alt="Generated" className="mt-2 rounded-lg border border-border/30 max-h-48 object-contain" />}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><Bot className="h-3 w-3" /></div>
                  <div className="rounded-2xl rounded-tl-sm bg-muted/60 px-3 py-2">
                    <div className="flex gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/50" style={{ animationDelay: "0ms" }} />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/50" style={{ animationDelay: "150ms" }} />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/50" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          <div className="flex items-center gap-2 border-t border-border/30 p-2.5">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleChatSubmit()}
              placeholder="e.g. 'Make it warmer' or 'Add wooden shelves'..."
              disabled={isGenerating || isAnalyzing}
              className="flex-1 bg-muted/30 border-border/50 focus:border-primary/50 h-8 text-xs"
            />
            <Button size="icon" onClick={handleChatSubmit} disabled={!inputMessage.trim() || isTyping || isGenerating} className="btn-premium h-8 w-8">
              {isTyping || isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </Card>

        {/* Image Display */}
        <Card className="glass-card-static flex flex-col items-center justify-center min-h-[320px]">
          <CardContent className="flex flex-col items-center gap-4 p-6 w-full">
            {generatedImageUrl ? (
              <>
                <img src={generatedImageUrl} alt="Redesigned room" className="w-full max-h-[420px] rounded-xl object-contain" />
                {generatedLabel && <p className="text-sm font-medium text-muted-foreground">{generatedLabel}</p>}
              </>
            ) : imagePreview ? (
              <>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Original Room</Label>
                <img src={imagePreview} alt="Original room" className="w-full max-h-[320px] rounded-xl object-contain" />
                <p className="text-sm text-muted-foreground text-center">Select themes and click <strong>"Redesign room"</strong>, or chat with the assistant above</p>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <Upload className="h-12 w-12 text-muted-foreground/40" />
                <p className="text-lg font-display font-semibold text-foreground">
                  Redesign your <span className="text-primary">room</span> in seconds
                </p>
                <p className="text-sm text-muted-foreground max-w-sm">Upload a room, specify the type, and select themes to redesign.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Save & Download bar */}
        {generatedImageUrl && (
          <div className="flex items-center justify-end gap-3">
            <Button
              variant="outline"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="gap-2 border-border/50 hover:border-primary/30"
            >
              <Wand2 className="h-4 w-4" /> Redesign again
            </Button>
            <Button
              variant="outline"
              onClick={handleSave}
              disabled={isSaving}
              className="gap-2 border-border/50 hover:border-primary/30"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save design
            </Button>
            <Button onClick={handleDownload} className="btn-premium gap-2">
              <Download className="h-4 w-4" /> Download photo
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Design2DTab;
