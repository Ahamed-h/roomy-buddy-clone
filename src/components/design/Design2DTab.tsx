import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  Wand2,
  Download,
  Loader2,
  Send,
  Bot,
  User,
  Save,
} from "lucide-react";
import { saveDesign } from "@/lib/designs";
import { cn } from "@/lib/utils";
import { geminiGenerateImage, geminiChat } from "@/services/geminiAI";

const ROOM_TYPES = [
  "Bedroom",
  "Living Room",
  "Kitchen",
  "Bathroom",
  "Dining Room",
  "Office",
  "Kids Room",
];

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

  const [currentImageBase64, setCurrentImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [roomType, setRoomType] = useState("Bedroom");
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [inputMessage, setInputMessage] = useState("");

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      role: "ai",
      content:
        "Hi 👋 Upload a room photo and select themes. Tell me what you'd like to change!",
    },
  ]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [chatHistory, isTyping]);

  const addMessage = useCallback(
    (role: "user" | "ai", content: string, imageUrl?: string) => {
      setChatHistory((prev) => [...prev, { role, content, imageUrl }]);
    },
    []
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      setCurrentImageBase64(base64);
      setImagePreview(base64);
      setGeneratedImageUrl(null);
      addMessage("ai", "📸 Room photo uploaded! Select themes and click Redesign, or tell me what to change.");
    };
    reader.readAsDataURL(file);
  };

  const toggleTheme = (id: string) => {
    setSelectedThemes((prev) => {
      if (prev.includes(id)) return prev.filter((t) => t !== id);
      if (prev.length >= MAX_THEMES) return prev;
      return [...prev, id];
    });
  };

  const buildPrompt = (extraNotes = "") => {
    const themeStr = selectedThemes
      .map((id) => THEMES.find((t) => t.id === id)?.label)
      .join(", ");

    return `Redesign this ${roomType.toLowerCase()} in ${themeStr || "modern"} style. ${extraNotes}. Keep the same room layout and perspective. Photorealistic interior design.`;
  };

  const generateImage = async (extraNotes = "") => {
    if (!currentImageBase64) return;

    setIsGenerating(true);
    addMessage("ai", "🎨 Generating your redesign with Gemini AI...");

    const prompt = buildPrompt(extraNotes);

    try {
      const result = await geminiGenerateImage(prompt, currentImageBase64);

      if (result.image_url) {
        setGeneratedImageUrl(result.image_url);
        addMessage("ai", "Here is your redesign 👇", result.image_url);
      } else if (result.description) {
        addMessage("ai", `💡 ${result.description}`);
      } else {
        addMessage("ai", "❌ No image was generated. Please try again.");
      }
    } catch (err: any) {
      addMessage("ai", `❌ Generation failed: ${err.message}`);
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    }

    setIsGenerating(false);
  };

  const handleGenerate = async () => {
    if (!currentImageBase64 || selectedThemes.length === 0) {
      toast({ title: "Upload photo and select at least one theme" });
      return;
    }
    await generateImage();
  };

  const handleChatSubmit = async () => {
    const msg = inputMessage.trim();
    if (!msg) return;

    setInputMessage("");
    addMessage("user", msg);

    // If there's a generated image, treat as a modification request
    if (generatedImageUrl && /change|add|remove|make|more|less|update|modify|warmer|cooler|brighter|darker/i.test(msg)) {
      await generateImage(msg);
      return;
    }

    // Otherwise use Gemini chat for design advice
    setIsTyping(true);
    try {
      const reply = await geminiChat(
        [{ role: "user", content: msg }],
        "You are an interior design assistant. Give brief, actionable advice. If the user describes changes, suggest they click 'Redesign Room' to see the result."
      );
      addMessage("ai", reply);
    } catch {
      addMessage("ai", "Try saying something like: 'Make it warmer' or 'Add wooden shelves', then click Redesign.");
    }
    setIsTyping(false);
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
      await saveDesign({
        type: "2d",
        name: `${roomType}`,
        thumbnail_url: generatedImageUrl,
        data: { roomType, themes: selectedThemes },
      });
      toast({ title: "Design saved!" });
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    }
    setIsSaving(false);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      {/* LEFT PANEL */}
      <div className="w-full lg:w-80 space-y-4 shrink-0">
        <Card>
          <CardContent className="p-3 space-y-3">
            <div
              className="border-2 border-dashed border-muted rounded-lg p-4 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {imagePreview ? (
                <img src={imagePreview} alt="Room" className="rounded max-h-48 mx-auto object-contain" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Upload className="w-8 h-8" />
                  <span className="text-sm">Upload JPG / PNG</span>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <Label className="text-xs mb-1 block">Room Type</Label>
            <Select value={roomType} onValueChange={setRoomType}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROOM_TYPES.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 grid grid-cols-3 gap-1.5">
            {THEMES.map((theme) => {
              const selected = selectedThemes.includes(theme.id);
              return (
                <button
                  key={theme.id}
                  onClick={() => toggleTheme(theme.id)}
                  className={cn(
                    "border px-2 py-2 text-xs rounded",
                    selected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {theme.label}
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Button onClick={handleGenerate} disabled={isGenerating} className="w-full gap-2">
          {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
          {isGenerating ? "Generating..." : "Redesign Room"}
        </Button>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex-1 min-w-0 flex flex-col">
        <Card className="flex-1">
          <CardContent className="p-4 h-full flex flex-col">
            {/* Chat / Image area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 mb-3 min-h-[300px]">
              {chatHistory.map((msg, i) => (
                <div key={i} className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
                  {msg.role === "ai" && <Bot className="w-5 h-5 text-primary shrink-0 mt-1" />}
                  <div className={cn(
                    "rounded-lg px-3 py-2 max-w-[80%] text-sm",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  )}>
                    <p>{msg.content}</p>
                    {msg.imageUrl && (
                      <img src={msg.imageUrl} alt="Generated" className="rounded-lg mt-2 max-h-[50vh] object-contain" />
                    )}
                  </div>
                  {msg.role === "user" && <User className="w-5 h-5 text-muted-foreground shrink-0 mt-1" />}
                </div>
              ))}
              {isTyping && (
                <div className="flex gap-2">
                  <Bot className="w-5 h-5 text-primary shrink-0 mt-1" />
                  <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground">Thinking…</div>
                </div>
              )}
            </div>

            {/* Action buttons for generated image */}
            {generatedImageUrl && (
              <div className="flex gap-2 mb-3 justify-center">
                <Button size="sm" variant="outline" onClick={handleSave} disabled={isSaving}>
                  <Save className="w-4 h-4 mr-1" />
                  {isSaving ? "Saving..." : "Save"}
                </Button>
                <Button size="sm" variant="outline" onClick={handleDownload}>
                  <Download className="w-4 h-4 mr-1" />
                  Download
                </Button>
              </div>
            )}

            {/* Chat input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleChatSubmit()}
                placeholder="Ask about design or request changes..."
                className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground placeholder:text-muted-foreground"
              />
              <Button size="sm" onClick={handleChatSubmit} disabled={isTyping || isGenerating}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Design2DTab;
