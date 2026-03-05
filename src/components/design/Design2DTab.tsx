import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Upload, Download, Loader2, Send, Bot, User, Save, ImagePlus,
} from "lucide-react";
import { saveDesign } from "@/lib/designs";
import { cn } from "@/lib/utils";
import {
  designChat, fileToBase64,
  type ChatResult,
} from "@/services/api";

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
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [inputMessage, setInputMessage] = useState("");

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { role: "ai", content: "Hi 👋 I'm your interior design assistant! Upload a room photo and tell me what you'd like — describe styles, colors, furniture changes, or moods. When you're ready, just say **\"generate\"** and I'll create a redesign based on our conversation." },
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
    const url = URL.createObjectURL(file);
    setImagePreview(url);
    setGeneratedImageUrl(null);
    addMessage("user", "📸 [Uploaded a room photo]", url);
    addMessage("ai", "Great photo! Tell me about the style, mood, or changes you'd like. When you're happy with the direction, say **\"generate\"** and I'll create the redesign.");
  };

  const handleChatSubmit = async () => {
    const msg = inputMessage.trim();
    if (!msg) return;
    setInputMessage("");
    addMessage("user", msg);

    // Build conversation history for the API (exclude system-only messages)
    const conversationForApi = chatHistory
      .filter((m) => !m.content.startsWith("📸 [Uploaded"))
      .map((m) => ({
        role: m.role === "ai" ? "assistant" : "user",
        content: m.content,
      }));
    conversationForApi.push({ role: "user", content: msg });

    // Check if user wants to generate
    const wantsGenerate = /\bgenerate\b/i.test(msg);

    if (wantsGenerate && !currentImage) {
      addMessage("ai", "Please upload a room photo first so I can generate a redesign based on our conversation.");
      return;
    }

    setIsTyping(true);
    try {
      // Get image base64 if available and user wants generation
      let imageBase64: string | undefined;
      if (currentImage && wantsGenerate) {
        imageBase64 = await fileToBase64(currentImage);
      }

      const result: ChatResult = await designChat(
        msg,
        "default",
        false,
        "",
        conversationForApi,
        imageBase64,
      );

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
        name: `AI Chat Redesign – ${new Date().toLocaleDateString()}`,
        thumbnail_url: generatedImageUrl,
        data: {
          originalImage: imagePreview,
          generatedImage: generatedImageUrl,
          chatHistory: chatHistory.map((m) => ({ role: m.role, content: m.content })),
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
      {/* LEFT PANEL — Upload only */}
      <div className="w-full lg:w-72 space-y-4 shrink-0">
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
                  <span className="text-sm">Upload Room Photo</span>
                  <span className="text-xs">JPG / PNG</span>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>
          </CardContent>
        </Card>

        {imagePreview && (
          <Card>
            <CardContent className="p-3 text-xs text-muted-foreground space-y-2">
              <p className="font-medium text-foreground text-sm">How it works</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Describe the style, mood, or changes you want</li>
                <li>Chat back and forth to refine your vision</li>
                <li>Say <strong>"generate"</strong> when ready</li>
              </ol>
            </CardContent>
          </Card>
        )}
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
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    {msg.imageUrl && (
                      <img src={msg.imageUrl} alt="Room" className="rounded-lg mt-2 max-h-[50vh] object-contain" />
                    )}
                  </div>
                  {msg.role === "user" && <User className="w-5 h-5 text-muted-foreground shrink-0 mt-1" />}
                </div>
              ))}
              {isTyping && (
                <div className="flex gap-2">
                  <Bot className="w-5 h-5 text-primary shrink-0 mt-1" />
                  <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground">
                    {isGenerating ? "🎨 Generating your redesign..." : "Thinking…"}
                  </div>
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
              <Button
                size="icon"
                variant="ghost"
                className="shrink-0"
                onClick={() => fileInputRef.current?.click()}
                title="Upload room photo"
              >
                <ImagePlus className="w-4 h-4" />
              </Button>
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleChatSubmit()}
                placeholder={currentImage ? 'Describe your vision, then say "generate"...' : "Upload a photo first, then describe your style..."}
                className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground placeholder:text-muted-foreground"
              />
              <Button size="sm" onClick={handleChatSubmit} disabled={isTyping || !inputMessage.trim()}>
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
