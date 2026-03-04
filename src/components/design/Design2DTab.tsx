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
  Save,
} from "lucide-react";
import { saveDesign } from "@/lib/designs";
import { cn } from "@/lib/utils";

const API = "http://localhost:8000"; // ✅ Forced local backend

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

  const [currentImage, setCurrentImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [roomType, setRoomType] = useState("Bedroom");
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCurrentImage(file);
    setImagePreview(URL.createObjectURL(file));
    setGeneratedImageUrl(null);
    setAnalysisResult(null);

    addMessage("ai", "Analyzing room...");

    const fd = new FormData();
    fd.append("file", file);

    try {
      const resp = await fetch(`${API}/analyze`, {
        method: "POST",
        body: fd,
      });

      if (!resp.ok) throw new Error("Analysis failed");

      const data = await resp.json();
      setAnalysisResult(data);
      addMessage("ai", `✅ Analysis complete! Score: ${data.aesthetic_score}/10`);
    } catch {
      addMessage("ai", "⚠️ Analysis unavailable.");
    }
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

    return `Redesign this ${roomType.toLowerCase()} in ${themeStr} style. ${extraNotes}. Photorealistic.`;
  };

  const generateImage = async (extraNotes = "") => {
    if (!currentImage) return;

    setIsGenerating(true);
    addMessage("ai", "🎨 Generating your redesign...");

    const prompt = buildPrompt(extraNotes);

    const fd = new FormData();
    fd.append("file", currentImage);
    fd.append("style_prompt", prompt);

    try {
      const resp = await fetch(`${API}/design/generate/2d/repaint`, {
        method: "POST",
        body: fd,
      });

      if (!resp.ok) throw new Error("Generation failed");

      const data = await resp.json();
      setGeneratedImageUrl(data.image_url);
      addMessage("ai", "Here is your redesign 👇", data.image_url);
    } catch {
      addMessage("ai", "❌ Image generation failed.");
    }

    setIsGenerating(false);
  };

  const handleGenerate = async () => {
    if (!currentImage || selectedThemes.length === 0) {
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

    const isModify =
      generatedImageUrl &&
      /change|add|remove|make|more|less|update|modify/i.test(msg);

    if (isModify) {
      await generateImage(msg);
      return;
    }

    setIsTyping(true);
    setTimeout(() => {
      addMessage(
        "ai",
        "Try saying something like: 'Make it warmer lighting' or 'Add wooden shelves'."
      );
      setIsTyping(false);
    }, 800);
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

    await saveDesign({
      type: "2d",
      name: `${roomType}`,
      thumbnail_url: generatedImageUrl,
      data: { roomType, themes: selectedThemes },
    });

    toast({ title: "Design saved!" });
    setIsSaving(false);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 p-4 h-full">
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
      <div className="flex-1 min-w-0">
        <Card className="h-full">
          <CardContent className="p-4 h-full flex flex-col">
            {generatedImageUrl ? (
              <>
                <img src={generatedImageUrl} alt="Redesign" className="rounded-lg max-h-[60vh] object-contain mx-auto" />
                <div className="flex gap-2 mt-3 justify-center">
                  <Button size="sm" variant="outline" onClick={handleSave} disabled={isSaving}>
                    <Save className="w-4 h-4 mr-1" />
                    {isSaving ? "Saving..." : "Save"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleDownload}>
                    <Download className="w-4 h-4 mr-1" />
                    Download
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <p className="text-sm">Upload and redesign your room.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Design2DTab;
