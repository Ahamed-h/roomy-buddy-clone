import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Upload, Sparkles, Send, Loader2, ImageIcon, ThumbsUp, ThumbsDown, Bot, User, TrendingUp } from "lucide-react";
import { getHfSpacesUrl } from "@/services/api";


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

  const [sessionId] = useState(() => crypto.randomUUID());
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [currentImage, setCurrentImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [includeEvaluation, setIncludeEvaluation] = useState(true);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [evaluationResult, setEvaluationResult] = useState<any>(null);
  const [aestheticHistory, setAestheticHistory] = useState<number[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [awaitingFeedback, setAwaitingFeedback] = useState(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chatHistory, isTyping]);

  useEffect(() => {
    setChatHistory([
      {
        role: "ai",
        content:
          "Hi! 👋 Let's design your space. Upload a room photo above, then I can analyze it and help you redesign.\n\n**Do you want to analyze your room photo first?** (Recommended)",
      },
    ]);
  }, []);

  const addMessage = useCallback((role: "user" | "ai", content: string, imageUrl?: string) => {
    setChatHistory((prev) => [...prev, { role, content, imageUrl }]);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCurrentImage(file);
      setImagePreview(URL.createObjectURL(file));
      setGeneratedImageUrl(null);
      setEvaluationResult(null);
      addMessage("ai", "Great photo! I can see your room. Would you like me to **analyze** it first to understand the current style, or jump straight to **redesign**?\n\nType `analyze` or pick a style and say `redesign`.");
    }
  };

  const runAnalysis = async () => {
    if (!currentImage) return;
    setIsAnalyzing(true);
    addMessage("ai", "🔍 Analyzing your room... This may take a moment.");
    try {
      const fd = new FormData();
      fd.append("file", currentImage);
      const resp = await fetch(`${API}/analyze`, { method: "POST", body: fd });
      if (!resp.ok) throw new Error(`Analysis failed: ${resp.status}`);
      const data = await resp.json();
      setEvaluationResult(data);
      setAestheticHistory((prev) => [...prev, data.aesthetic_score]);
      const topStyles = data.possible_styles?.slice(0, 3).join(", ") || "mixed";
      const recs = data.recommendations?.slice(0, 2).map((r: string) => `• ${r}`).join("\n") || "None";
      addMessage(
        "ai",
        `✅ **Analysis complete!**\n\n` +
          `**Aesthetic Score:** ${data.aesthetic_score}/10\n` +
          `**Detected Style:** ${topStyles}\n` +
          `**Brightness:** ${data.lighting?.brightness ?? "N/A"}%\n` +
          `**Objects found:** ${data.objects?.length ?? 0}\n\n` +
          `**Top Recommendations:**\n${recs}\n\n` +
          `What style would you like to transform it to? Pick from the dropdown above or just tell me!`
      );
    } catch (err: any) {
      addMessage("ai", `❌ Analysis failed: ${err.message}. Make sure your local server is running at ${API}.`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const runRedesign = async (styleOverride?: string) => {
    if (!currentImage) {
      addMessage("ai", "Please upload a room photo first!");
      return;
    }
    const style = styleOverride || "modern";
    setIsGenerating(true);
    setAwaitingFeedback(false);
    addMessage("ai", `🎨 Generating a redesign... Please wait.${includeEvaluation && evaluationResult ? " (Including evaluation data)" : ""}`);
    try {
      let enhancedPrompt = style;
      if (includeEvaluation && evaluationResult) {
        try {
          const promptResp = await fetch(`${API}/design/enhance_prompt`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ evaluation_json: evaluationResult, user_style: style }),
          });
          if (promptResp.ok) {
            const promptData = await promptResp.json();
            enhancedPrompt = promptData.enhanced_prompt || style;
          }
        } catch {}
      }
      const fd = new FormData();
      fd.append("file", currentImage);
      fd.append("style_prompt", enhancedPrompt);
      const resp = await fetch(`${API}/design/generate/2d/repaint`, { method: "POST", body: fd });
      if (!resp.ok) throw new Error(`Generation failed: ${resp.status}`);
      const data = await resp.json();
      setGeneratedImageUrl(data.image_url);
      try {
        const evalFd = new FormData();
        const imgResp = await fetch(data.image_url);
        const blob = await imgResp.blob();
        evalFd.append("file", new File([blob], "generated.jpg"));
        const evalResp = await fetch(`${API}/analyze`, { method: "POST", body: evalFd });
        if (evalResp.ok) {
          const evalData = await evalResp.json();
          setAestheticHistory((prev) => [...prev, evalData.aesthetic_score]);
        }
      } catch {}
      addMessage("ai", `Here's your **${style}** redesign! 👇\n\nIs this design good? Use the buttons below, or tell me what you'd like to change.`, data.image_url);
      setAwaitingFeedback(true);
    } catch (err: any) {
      addMessage("ai", `❌ Generation failed: ${err.message}. Ensure the server is running at ${API}.`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleChatSubmit = async () => {
    const msg = inputMessage.trim();
    if (!msg) return;
    setInputMessage("");
    addMessage("user", msg);
    const lower = msg.toLowerCase();
    if (lower.includes("analyze") || lower.includes("evaluate") || lower === "yes") {
      await runAnalysis();
      return;
    }
    const styleKeywords = ["modern", "scandinavian", "industrial", "minimalist", "boho"];
    const matchedStyle = styleKeywords.find((s) => lower.includes(s));
    if (matchedStyle && (lower.includes("redesign") || lower.includes("transform") || lower.includes("change") || lower.includes("make it") || lower.includes("convert"))) {
      await runRedesign(matchedStyle);
      return;
    }
    if (lower.includes("redesign") || lower.includes("generate") || lower.includes("create")) {
      await runRedesign();
      return;
    }
    setIsTyping(true);
    try {
      const resp = await fetch(`${API}/design/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, message: msg }),
      });
      if (!resp.ok) throw new Error(`Chat failed: ${resp.status}`);
      const data = await resp.json();
      addMessage("ai", data.response || "I'm not sure how to help with that. Try asking about room design!");
      if (data.action === "generate") {
        await runRedesign(data.params?.style || "modern");
      } else if (data.action === "analyze") {
        await runAnalysis();
      }
    } catch {
      addMessage("ai", "I couldn't reach the chat server. You can still:\n• Type `analyze` to evaluate your photo\n• Type `redesign` to generate a new design\n• Pick a style from the dropdown and say `redesign`");
    } finally {
      setIsTyping(false);
    }
  };

  const handleFeedback = async (good: boolean) => {
    setAwaitingFeedback(false);
    if (good) {
      addMessage("user", "This looks great! 👍");
      const latest = aestheticHistory[aestheticHistory.length - 1];
      addMessage(
        "ai",
        `Wonderful! 🎉 Glad you like it.${latest ? ` Current aesthetic score: **${latest.toFixed(1)}/10**.` : ""}\n\nWant to try another style, or are we done?`
      );
    } else {
      addMessage("user", "Not quite right yet. 👎");
      addMessage("ai", "No problem! Tell me what you'd like to change — colors, furniture layout, lighting, specific items? I'll iterate on the design.");
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
            <circle
              key={i}
              cx={(i / (aestheticHistory.length - 1)) * w}
              cy={h - ((v - min) / (max - min)) * h}
              r="3"
              fill="hsl(var(--primary))"
            />
          ))}
        </svg>
        <span>{aestheticHistory[aestheticHistory.length - 1]?.toFixed(1)}</span>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Top: Upload + Style */}
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
              <Switch
                id="include-eval"
                checked={includeEvaluation}
                onCheckedChange={setIncludeEvaluation}
              />
              <Label htmlFor="include-eval" className="text-sm font-medium text-foreground cursor-pointer">
                Add evaluation result?
              </Label>
              {!evaluationResult && includeEvaluation && (
                <span className="text-xs text-muted-foreground">(Run analysis first)</span>
              )}
            </div>
            {renderSparkline()}
          </CardContent>
        </Card>
      </div>

      {/* Chat Interface */}
      <Card className="flex flex-col glass-card-static" style={{ height: "480px" }}>
        <ScrollArea ref={scrollRef} className="flex-1 p-4">
          <div className="space-y-4">
            {chatHistory.map((msg, i) => (
              <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    msg.role === "ai" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {msg.role === "ai" ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                </div>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === "ai"
                      ? "rounded-tl-sm bg-muted/60 text-foreground backdrop-blur-sm"
                      : "rounded-tr-sm bg-primary text-primary-foreground"
                  }`}
                >
                  {msg.content.split("\n").map((line, j) => (
                    <p key={j} className={j > 0 ? "mt-1.5" : ""}>
                      {line.split(/(\*\*.*?\*\*)/).map((part, k) =>
                        part.startsWith("**") && part.endsWith("**") ? (
                          <strong key={k}>{part.slice(2, -2)}</strong>
                        ) : (
                          <span key={k}>{part}</span>
                        )
                      )}
                    </p>
                  ))}
                  {msg.imageUrl && (
                    <img src={msg.imageUrl} alt="Generated" className="mt-3 rounded-lg border border-border/30" />
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
            placeholder="Type 'analyze', 'redesign', or describe what you want..."
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
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-lg text-foreground">Generated Design</CardTitle>
          </CardHeader>
          <CardContent>
            <img src={generatedImageUrl} alt="Generated design" className="w-full rounded-lg" />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Design2DTab;
