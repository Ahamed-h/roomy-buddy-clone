import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Upload, Wand2, Download, Loader2, CheckCircle2 } from "lucide-react";
import { getHfSpacesUrl } from "@/services/api";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const ROOM_TYPES = ["Bedroom", "Living Room", "Kitchen", "Bathroom", "Dining Room", "Office", "Kids Room"];

const QUALITY_OPTIONS = [
  { value: "fast", label: "Fast (Standard) – 1 credit" },
  { value: "hd", label: "HD (High Quality) – 2 credits" },
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

const Design2DTab = () => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const API = getHfSpacesUrl();

  const [currentImage, setCurrentImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [roomType, setRoomType] = useState("Bedroom");
  const [quality, setQuality] = useState("fast");
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [generatedLabel, setGeneratedLabel] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [pipelineStep, setPipelineStep] = useState<string | null>(null);

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

    // Auto-analyze
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

      // Auto-run AI verification
      setPipelineStep("AI verifying results...");
      try {
        const b64 = await fileToBase64(file);
        const { data: verified, error } = await supabase.functions.invoke("verify-analysis", {
          body: { analysisResult: data, imageBase64: b64 },
        });
        if (!error && verified?.corrected) {
          setAnalysisResult(verified.corrected);
        }
      } catch {}

      toast({ title: "Room analyzed!", description: "Select themes and generate your redesign." });
    } catch {
      toast({ title: "Analysis skipped", description: "Describe your room with themes instead.", variant: "destructive" });
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

  const buildSmartPrompt = async (): Promise<string> => {
    const themeStr = selectedThemes.map((id) => THEMES.find((t) => t.id === id)?.label).filter(Boolean).join(", ");
    const userStyle = `${themeStr} style ${roomType.toLowerCase()}`;

    if (analysisResult) {
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
      return `Redesign this ${roomType.toLowerCase()} in a ${themeStr} style. Current objects: ${objects}. Keep room layout, transform the aesthetic. Photorealistic.`;
    }

    return `Redesign this ${roomType.toLowerCase()} in a ${themeStr} style. Make it photorealistic and keep the room layout.`;
  };

  const handleGenerate = async () => {
    if (!currentImage || selectedThemes.length === 0) {
      toast({ title: "Upload a photo and select at least one theme" });
      return;
    }

    setIsGenerating(true);
    setPipelineStep("Building smart prompt...");

    try {
      const prompt = await buildSmartPrompt();
      const themeLabel = selectedThemes.map((id) => THEMES.find((t) => t.id === id)?.label).join(" + ");
      setGeneratedLabel(`${themeLabel} ${roomType}`);

      // Try local backend first
      setPipelineStep("Generating redesign (local)...");
      try {
        const fd = new FormData();
        fd.append("file", currentImage);
        fd.append("style_prompt", prompt);
        const resp = await fetch(`${API}/design/generate/2d/repaint`, { method: "POST", body: fd });
        if (resp.ok) {
          const data = await resp.json();
          if (data.image_url) {
            setGeneratedImageUrl(data.image_url);
            return;
          }
        }
      } catch {}

      // Fallback: Cloud
      setPipelineStep("Generating redesign (cloud)...");
      const b64 = imageBase64 || await fileToBase64(currentImage);
      const { data, error } = await supabase.functions.invoke("generate-image", {
        body: { prompt, imageBase64: b64 },
      });
      if (error) throw error;
      if (data?.image_url) {
        setGeneratedImageUrl(data.image_url);
      } else {
        toast({ title: "Generation failed", description: "Try different themes.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
      setPipelineStep(null);
    }
  };

  const handleDownload = () => {
    if (!generatedImageUrl) return;
    const a = document.createElement("a");
    a.href = generatedImageUrl;
    a.download = `redesign-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      {/* ── Left Sidebar ── */}
      <div className="space-y-5">
        {/* Upload */}
        <Card className="glass-card-static">
          <CardContent className="p-4 space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Upload a photo of your room
            </Label>
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
            {imagePreview && (
              <p className="text-[10px] text-muted-foreground truncate">{currentImage?.name}</p>
            )}
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
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Select Room Type
            </Label>
            <Select value={roomType} onValueChange={setRoomType}>
              <SelectTrigger className="bg-muted/30 border-border/50">
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

        {/* Quality */}
        <Card className="glass-card-static">
          <CardContent className="p-4 space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Select Quality
            </Label>
            <Select value={quality} onValueChange={setQuality}>
              <SelectTrigger className="bg-muted/30 border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUALITY_OPTIONS.map((q) => (
                  <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Themes */}
        <Card className="glass-card-static">
          <CardContent className="p-4 space-y-3">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Select Room Themes (up to {MAX_THEMES})
            </Label>
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
                      selected
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border/50 bg-muted/20 text-muted-foreground hover:border-primary/30 hover:bg-muted/40",
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

        {/* Generate Button */}
        <Button
          onClick={handleGenerate}
          disabled={!currentImage || selectedThemes.length === 0 || isGenerating}
          className="w-full btn-premium gap-2"
          size="lg"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {pipelineStep || "Generating..."}
            </>
          ) : (
            <>
              <Wand2 className="h-4 w-4" /> Redesign room
            </>
          )}
        </Button>
      </div>

      {/* ── Right Panel: Image Display ── */}
      <Card className="glass-card-static flex flex-col items-center justify-center min-h-[480px]">
        <CardContent className="flex flex-col items-center gap-4 p-6 w-full">
          {generatedImageUrl ? (
            <>
              <img
                src={generatedImageUrl}
                alt="Redesigned room"
                className="w-full max-h-[520px] rounded-xl object-contain"
              />
              {generatedLabel && (
                <p className="text-sm font-medium text-muted-foreground">{generatedLabel}</p>
              )}
              <div className="flex gap-3">
                <Button onClick={handleGenerate} disabled={isGenerating} className="btn-premium gap-2">
                  <Wand2 className="h-4 w-4" /> Redesign new room
                </Button>
                <Button variant="outline" onClick={handleDownload} className="gap-2 border-border/50 hover:border-primary/30">
                  <Download className="h-4 w-4" /> Download photo
                </Button>
              </div>
            </>
          ) : imagePreview ? (
            <>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Original Room
              </Label>
              <img
                src={imagePreview}
                alt="Original room"
                className="w-full max-h-[420px] rounded-xl object-contain"
              />
              <p className="text-sm text-muted-foreground text-center max-w-md">
                Select themes on the left and click <strong>"Redesign room"</strong> to generate your new design.
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <Upload className="h-12 w-12 text-muted-foreground/40" />
              <div>
                <p className="text-lg font-display font-semibold text-foreground">
                  Redesign your <span className="text-primary">room</span> in seconds
                </p>
                <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                  Upload a room, specify the room type, and select your room theme to redesign.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Design2DTab;
