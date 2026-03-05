import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Upload, Wand2, Download, Loader2, Send, Bot, User, Save,
} from "lucide-react";
import { saveDesign } from "@/lib/designs";
import { cn } from "@/lib/utils";
import {
  repaintRoom, designChat,
  type ChatResult,
} from "@/services/api";

const ROOM_TYPES = [
  "Bedroom", "Living Room", "Kitchen", "Bathroom",
  "Dining Room", "Office", "Kids Room",
];

const STYLES = [
  { id: "modern", label: "Modern" },
  { id: "minimalist", label: "Minimalist" },
  { id: "scandinavian", label: "Scandinavian" },
  { id: "industrial", label: "Industrial" },
  { id: "luxury", label: "Luxury" },
  { id: "bohemian", label: "Bohemian" },
  { id: "mediterranean", label: "Mediterranean" },
  { id: "japandi", label: "Japandi" },
];

interface ChatMessage {
  role: "user" | "ai";
  content: string;
  imageUrl?: string;
}

const Design2DTab = () => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [currentImage, setCurrentImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [roomType, setRoomType] = useState("Living Room");
  const [selectedStyle, setSelectedStyle] = useState("modern");
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [inputMessage, setInputMessage] = useState("");

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { role: "ai", content: "Hi 👋 Upload a room photo, select a style, and click Redesign — or ask me for design advice!" },
  ]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chatHistory, isTyping]);

  const addMessage = useCallback(
    (role: "user" | "ai", content: string, imageUrl?: string) => {
      setChatHistory((prev) => [...prev, { role, content, imageUrl }]);
    }, []
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCurrentImage(file);
    setImagePreview(URL.createObjectURL(file));
    setGeneratedImageUrl(null);
    addMessage("ai", "📸 Room photo uploaded! Select a style and click Redesign, or tell me what to change.");
  };

  const buildPrompt = (extra = "") => {
    const styleLabel = STYLES.find((s) => s.id === selectedStyle)?.label || "modern";
    return `Redesign this ${roomType.toLowerCase()} in ${styleLabel} style. ${extra}. Keep the same room layout and perspective. Photorealistic interior design.`;
  };

  const generateImage = async (extraNotes = "") => {
    if (!currentImage) return;
    setIsGenerating(true);
    addMessage("ai", "🎨 Generating redesign with AI...");

    try {
      const result = await repaintRoom(
        currentImage,
        buildPrompt(extraNotes),
        selectedStyle,
      );
      if (result.image_url) {
        setGeneratedImageUrl(result.image_url);
        addMessage("ai", `Here is your ${STYLES.find(s => s.id === selectedStyle)?.label} redesign 👇`, result.image_url);
      } else {
        addMessage("ai", `Design description: ${result.description}`);
      }
    } catch (err: any) {
      addMessage("ai", `❌ Generation failed: ${err.message}`);
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    }
    setIsGenerating(false);
  };

  const handleGenerate = async () => {
    if (!currentImage) {
      toast({ title: "Upload a room photo first" });
      return;
    }
    await generateImage();
  };

  const handleChatSubmit = async () => {
    const msg = inputMessage.trim();
    if (!msg) return;
    setInputMessage("");
    addMessage("user", msg);

    setIsTyping(true);
    try {
      const result: ChatResult = await designChat(msg);

      if (result.action === "generate" && result.image_url) {
        setGeneratedImageUrl(result.image_url);
        addMessage("ai", result.response, result.image_url);
      } else {
        addMessage("ai", result.response);
      }
    } catch {
      addMessage("ai", "Couldn't reach the AI service. Please try again.");
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
        name: `${roomType} – ${STYLES.find(s => s.id === selectedStyle)?.label}`,
        thumbnail_url: generatedImageUrl,
        data: {
          roomType,
          style: selectedStyle,
          originalImage: imagePreview,
          generatedImage: generatedImageUrl,
        },
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
        {/* Upload */}
        <Card>
          <CardContent className="p-3">
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

        {/* Room type */}
        <Card>
          <CardContent className="p-3">
            <Label className="text-xs mb-1 block">Room Type</Label>
            <Select value={roomType} onValueChange={setRoomType}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROOM_TYPES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Style */}
        <Card>
          <CardContent className="p-3">
            <Label className="text-xs mb-1 block">Design Style</Label>
            <Select value={selectedStyle} onValueChange={setSelectedStyle}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STYLES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Button onClick={handleGenerate} disabled={isGenerating} className="w-full gap-2 btn-premium">
          {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
          {isGenerating ? "Generating..." : "Redesign Room"}
        </Button>
      </div>

      {/* RIGHT PANEL — Chat */}
      <div className="flex-1 min-w-0 flex flex-col">
        <Card className="flex-1">
          <CardContent className="p-4 h-full flex flex-col">
            <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 mb-3 min-h-[300px]">
              {chatHistory.map((msg, i) => (
                <div key={i} className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
                  {msg.role === "ai" && <Bot className="w-5 h-5 text-primary shrink-0 mt-1" />}
                  <div className={cn(
                    "rounded-lg px-3 py-2 max-w-[80%] text-sm",
                    msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
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

            {generatedImageUrl && (
              <div className="flex gap-2 mb-3 justify-center">
                <Button size="sm" variant="outline" onClick={handleSave} disabled={isSaving}>
                  <Save className="w-4 h-4 mr-1" /> {isSaving ? "Saving..." : "Save"}
                </Button>
                <Button size="sm" variant="outline" onClick={handleDownload}>
                  <Download className="w-4 h-4 mr-1" /> Download
                </Button>
              </div>
            )}

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
