import { useState, useRef, useCallback, useMemo } from "react";
import { Loader2, Sparkles, Send, Download, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FloorPlanCanvas } from "./FloorPlanCanvas";
import { InsightsPanel, LegendPanel, EditPanel } from "./SidePanels";
import { analyzeFloorplan } from "./analyzeFloorplan";
import type { AnalyzedRoom, FloorPlanAnalysis } from "./types";
import { ROOM_COLORS } from "./types";
import { generateFloorplanRoom } from "@/services/api";

type Step = "upload" | "analyzing" | "results" | "generating" | "generated";

export default function FloorPlanAnalyzer() {
  const { toast } = useToast();

  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgBase64, setImgBase64] = useState<string | null>(null);
  const [dims, setDims] = useState({ w: 800, h: 600 });

  const [rooms, setRooms] = useState<AnalyzedRoom[]>([]);
  const [analysis, setAnalysis] = useState<FloorPlanAnalysis | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [step, setStep] = useState<Step>("upload");
  const [activeTab, setActiveTab] = useState("insights");
  const [error, setError] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // User suggestions input
  const [userSuggestions, setUserSuggestions] = useState("");
  const [selectedAiSuggestions, setSelectedAiSuggestions] = useState<string[]>([]);

  // Generated image
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedDescription, setGeneratedDescription] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);

  const selectedRoom = useMemo(
    () => rooms.find(r => r.id === selectedId) || null,
    [rooms, selectedId]
  );

  const loadFile = useCallback((file: File | undefined) => {
    if (!file?.type.startsWith("image/")) {
      setError("Please upload an image file (PNG, JPG, WEBP).");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      setImgUrl(url);
      setImgBase64(url);
      setRooms([]);
      setAnalysis(null);
      setSelectedId(null);
      setSelectedAiSuggestions([]);
      setUserSuggestions("");
      setGeneratedImage(null);
      setGeneratedDescription("");
      setError(null);
      setStep("upload");
      const img = new Image();
      img.onload = () => setDims({ w: img.naturalWidth, h: img.naturalHeight });
      img.src = url;
    };
    reader.readAsDataURL(file);
  }, []);

  const runAnalysis = useCallback(async () => {
    if (!imgUrl) return;
    setStep("analyzing");
    setError(null);
    try {
      const result = await analyzeFloorplan(imgUrl);
      const withIds = (result.rooms || []).map((r, i) => ({ ...r, id: r.id || `r${i}` }));
      setRooms(withIds);
      setAnalysis(result);
      setSelectedAiSuggestions([]);
      setUserSuggestions("");
      setGeneratedImage(null);
      setActiveTab("insights");
      setStep("results");
      toast({ title: "Analysis Complete", description: `Detected ${withIds.length} rooms. Score: ${result.score}/10` });
    } catch (e: any) {
      setError("Analysis failed: " + e.message);
      setStep("upload");
      toast({ title: "Analysis Failed", description: e.message, variant: "destructive" });
    }
  }, [imgUrl, toast]);

  const updateRoom = useCallback((id: string, patch: Partial<AnalyzedRoom>) => {
    setRooms(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  }, []);

  const deleteRoom = useCallback((id: string) => {
    setRooms(prev => prev.filter(r => r.id !== id));
    setSelectedId(null);
  }, []);

  const addRoom = useCallback(() => {
    const newRoom: AnalyzedRoom = {
      id: `r_new_${Date.now()}`, type: "Unknown", label: "New Room",
      estimatedSqFt: 0, x: 10, y: 10, width: 20, height: 15,
    };
    setRooms(prev => [...prev, newRoom]);
    setSelectedId(newRoom.id);
    setActiveTab("edit");
  }, []);

  const toggleAiSuggestion = useCallback((text: string) => {
    setSelectedAiSuggestions(prev =>
      prev.includes(text) ? prev.filter(s => s !== text) : [...prev, text]
    );
  }, []);

  const generateFloorplan = useCallback(async () => {
    if (!analysis || !imgBase64) return;
    setStep("generating");
    setError(null);

    try {
      // Convert data URL to File
      const resp = await fetch(imgBase64);
      const blob = await resp.blob();
      const file = new File([blob], "floorplan.png", { type: blob.type });

      // Pick the first room type or default
      const roomLabel = rooms[0]?.label || "living room";
      const style = "modern";

      const result = await generateFloorplanRoom(file, roomLabel, style);

      if (result.image_b64) {
        const imgUrl = `data:image/png;base64,${result.image_b64}`;
        setGeneratedImage(imgUrl);
        setGeneratedDescription(result.description || "");
        setStep("generated");
        toast({ title: "Room Generated!", description: "Your room visualization is ready." });
      } else {
        throw new Error("No image was generated. Try again.");
      }
    } catch (e: any) {
      setError("Generation failed: " + e.message);
      setStep("results");
      toast({ title: "Generation Failed", description: e.message, variant: "destructive" });
    }
  }, [analysis, rooms, imgBase64, toast]);

  const handleDownload = useCallback(() => {
    if (!generatedImage) return;
    const a = document.createElement("a");
    a.href = generatedImage;
    a.download = `floorplan-redesign-${Date.now()}.png`;
    a.click();
  }, [generatedImage]);

  const resetToResults = useCallback(() => {
    setGeneratedImage(null);
    setGeneratedDescription("");
    setStep("results");
  }, []);

  const resetAll = useCallback(() => {
    setImgUrl(null);
    setImgBase64(null);
    setRooms([]);
    setAnalysis(null);
    setSelectedId(null);
    setSelectedAiSuggestions([]);
    setUserSuggestions("");
    setGeneratedImage(null);
    setGeneratedDescription("");
    setStep("upload");
    setError(null);
  }, []);

  const tabs = [
    { id: "insights", label: "📊 Insights" },
    { id: "legend", label: "🗂 Rooms" },
    { id: "edit", label: "✎ Edit" },
  ];

  return (
    <div className="min-h-[600px] rounded-xl overflow-hidden bg-gradient-to-b from-background to-muted/30 border border-border/50">
      <style>{`@keyframes scanBar { 0% { width: 0%; margin-left: 0% } 50% { width: 55%; margin-left: 22% } 100% { width: 0%; margin-left: 100% } }`}</style>

      {/* Header */}
      <div className="text-center py-5 border-b border-border/30">
        <div className="text-xl font-black text-foreground tracking-tight">🏗 Floor Plan Analyzer</div>
        <div className="text-[12.5px] text-muted-foreground mt-1">Upload → AI Analyzes → Review Suggestions → Generate Redesign</div>
      </div>

      {/* Upload zone */}
      {!imgUrl && (
        <div
          className="max-w-[540px] mx-auto my-8 border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all"
          style={{
            borderColor: isDraggingFile ? "hsl(var(--primary))" : "hsl(var(--border))",
            background: isDraggingFile ? "hsl(var(--primary) / 0.05)" : "hsl(var(--muted) / 0.3)",
          }}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
          onDragLeave={() => setIsDraggingFile(false)}
          onDrop={(e) => { e.preventDefault(); setIsDraggingFile(false); loadFile(e.dataTransfer.files[0]); }}
        >
          <div className="text-[50px] mb-3">📐</div>
          <div className="text-foreground font-bold text-base mb-1.5">Drop your floor plan here</div>
          <div className="text-muted-foreground text-[13px]">PNG, JPG or WEBP</div>
          <div className="mt-4 inline-block bg-primary/10 border border-primary/25 text-primary rounded-lg py-2 px-5 text-[13px] font-semibold">
            Browse Files
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => loadFile(e.target.files?.[0])} />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="max-w-[640px] mx-auto mt-3 p-2.5 px-3.5 rounded-lg text-[13px] bg-destructive/10 border border-destructive/20 text-destructive">
          ⚠ {error}
        </div>
      )}

      {/* Analyzing spinner */}
      {step === "analyzing" && (
        <div className="text-center mt-8 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" />
          <div className="text-sm">🤖 AI is analysing your floor plan…</div>
          <div className="h-1 max-w-xs mx-auto mt-3 bg-muted rounded overflow-hidden">
            <div className="h-full rounded bg-primary" style={{ animation: "scanBar 1.4s ease-in-out infinite" }} />
          </div>
        </div>
      )}

      {/* Pre-analysis preview */}
      {imgUrl && step === "upload" && (
        <div className="text-center mt-4 mb-5 px-5">
          <img src={imgUrl} alt="preview" className="max-w-full max-h-[300px] rounded-[10px] object-contain mb-4 mx-auto shadow-lg" />
          <button onClick={runAnalysis} className="bg-primary text-primary-foreground rounded-[10px] py-3 px-9 text-[15px] font-bold cursor-pointer border-none shadow-lg hover:opacity-90 transition-opacity">
            🔍 Analyse Floor Plan with AI
          </button>
        </div>
      )}

      {/* Generating spinner */}
      {step === "generating" && (
        <div className="text-center mt-8 text-muted-foreground pb-8">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-3 text-primary" />
          <div className="text-sm font-medium">✨ AI is generating your redesigned floor plan…</div>
          <div className="text-xs text-muted-foreground mt-1">This may take 15-30 seconds</div>
          <div className="h-1 max-w-xs mx-auto mt-3 bg-muted rounded overflow-hidden">
            <div className="h-full rounded bg-primary" style={{ animation: "scanBar 2s ease-in-out infinite" }} />
          </div>
        </div>
      )}

      {/* Generated result */}
      {step === "generated" && generatedImage && (
        <div className="max-w-[900px] mx-auto px-5 pb-6 mt-4">
          <div className="flex gap-2 mb-4 flex-wrap items-center">
            <ActionBtn icon={<RotateCcw className="w-3.5 h-3.5" />} onClick={resetToResults}>← Back to Analysis</ActionBtn>
            <ActionBtn icon={<RotateCcw className="w-3.5 h-3.5" />} onClick={resetAll}>New Plan</ActionBtn>
            <div className="ml-auto">
              <ActionBtn icon={<Download className="w-3.5 h-3.5" />} onClick={handleDownload} variant="primary">Download</ActionBtn>
            </div>
          </div>

          {generatedDescription && (
            <div className="bg-muted/30 border border-border/50 rounded-xl p-4 mb-4 text-sm text-muted-foreground">
              <div className="font-semibold text-foreground mb-1">✨ AI Description</div>
              {generatedDescription}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">📐 Original Floor Plan</div>
              <img src={imgUrl!} alt="Original" className="w-full rounded-xl shadow-lg border border-border/30" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">✨ AI Generated Redesign</div>
              <img src={generatedImage} alt="Generated" className="w-full rounded-xl shadow-lg border border-primary/30" />
            </div>
          </div>

          {/* Generate again with different suggestions */}
          <div className="mt-6 bg-muted/20 border border-border/50 rounded-xl p-5">
            <div className="font-semibold text-foreground mb-2">🔄 Not happy? Refine and regenerate</div>
            <textarea
              value={userSuggestions}
              onChange={e => setUserSuggestions(e.target.value)}
              placeholder="Describe additional changes you'd like..."
              className="w-full p-3 rounded-lg border border-border bg-background text-foreground text-sm h-20 resize-y mb-3"
            />
            <button
              onClick={generateFloorplan}
              className="bg-primary text-primary-foreground rounded-lg py-2.5 px-6 text-sm font-bold cursor-pointer border-none hover:opacity-90 transition-opacity flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" /> Regenerate
            </button>
          </div>
        </div>
      )}

      {/* Main results view */}
      {(step === "results") && imgUrl && (
        <div className="max-w-[1300px] mx-auto px-5 pb-6">
          {/* Toolbar */}
          <div className="flex gap-2 mb-4 mt-4 flex-wrap items-center">
            <ActionBtn onClick={resetAll}>↩ New Plan</ActionBtn>
            <ActionBtn onClick={addRoom}>＋ Add Room</ActionBtn>
            <ActionBtn onClick={runAnalysis} variant="primary">🔄 Re-analyse</ActionBtn>
            <div className="ml-auto text-[11.5px] text-muted-foreground">Drag rooms to reposition · drag red corner to resize</div>
          </div>

          <div className="flex gap-4 items-start flex-wrap">
            {/* Left: Canvas */}
            <div className="flex-1 min-w-[300px]">
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">📐 Analyzed Floor Plan</div>
              <FloorPlanCanvas
                imgUrl={imgUrl}
                rooms={rooms}
                selectedId={selectedId}
                onSelect={(id) => { setSelectedId(id); if (id) setActiveTab("edit"); }}
                onUpdate={updateRoom}
                dims={dims}
                label="Your Floor Plan"
              />
              <div className="mt-2.5 flex flex-wrap gap-1">
                {rooms.map(r => {
                  const c = ROOM_COLORS[r.type] || ROOM_COLORS.Unknown;
                  return (
                    <div key={r.id} className="flex items-center gap-1 py-0.5 px-2 rounded-full text-[11px] font-semibold" style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
                      {r.label || r.type}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Side panel */}
            <div className="w-[320px] min-w-[260px] shrink-0 space-y-4">
              {/* Tabs panel */}
              <div>
                <div className="flex gap-0.5 mb-2.5 bg-muted/50 rounded-[10px] p-0.5">
                  {tabs.map(({ id, label }) => (
                    <button key={id} onClick={() => setActiveTab(id)} className="flex-1 py-1.5 px-0.5 rounded-lg border-none cursor-pointer text-[11px] font-medium transition-all" style={{
                      background: activeTab === id ? "hsl(var(--background))" : "transparent",
                      color: activeTab === id ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                      fontWeight: activeTab === id ? 700 : 500,
                    }}>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="bg-card rounded-xl p-4 shadow-lg border border-border/50 max-h-[50vh] overflow-y-auto">
                  {activeTab === "insights" && analysis && <InsightsPanel analysis={analysis} />}
                  {activeTab === "legend" && <LegendPanel rooms={rooms} />}
                  {activeTab === "edit" && (
                    <EditPanel
                      room={selectedRoom}
                      onUpdate={(patch) => selectedId && updateRoom(selectedId, patch)}
                      onDelete={() => selectedId && deleteRoom(selectedId)}
                      onClose={() => setSelectedId(null)}
                    />
                  )}
                </div>
              </div>

              {/* AI Suggestions selection */}
              {analysis && (analysis.recommendations?.length > 0 || analysis.insights?.length > 0) && (
                <div className="bg-card rounded-xl p-4 shadow-lg border border-border/50">
                  <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">✨ AI Suggestions — Select to Apply</div>
                  <div className="space-y-1.5 max-h-[30vh] overflow-y-auto">
                    {(analysis.recommendations || []).map(r => {
                      const text = `${r.title}: ${r.description}`;
                      const isChecked = selectedAiSuggestions.includes(text);
                      const impactColor = r.impact === "high" ? "text-destructive" : r.impact === "medium" ? "text-yellow-600" : "text-green-600";
                      return (
                        <div key={r.id} onClick={() => toggleAiSuggestion(text)} className="p-2.5 rounded-lg cursor-pointer transition-all border-2" style={{
                          borderColor: isChecked ? "hsl(var(--primary))" : "hsl(var(--border) / 0.5)",
                          background: isChecked ? "hsl(var(--primary) / 0.05)" : "transparent",
                        }}>
                          <div className="flex items-start gap-2">
                            <div className="w-4 h-4 rounded shrink-0 mt-0.5 flex items-center justify-center border-2" style={{
                              borderColor: isChecked ? "hsl(var(--primary))" : "hsl(var(--border))",
                              background: isChecked ? "hsl(var(--primary))" : "transparent",
                            }}>
                              {isChecked && <span className="text-primary-foreground text-[10px] font-black">✓</span>}
                            </div>
                            <div className="flex-1">
                              <div className="text-[12px] font-semibold text-foreground">
                                {r.title}
                                <span className={`ml-1.5 text-[10px] ${impactColor}`}>● {r.impact}</span>
                              </div>
                              <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">{r.description}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* User suggestions input */}
              <div className="bg-card rounded-xl p-4 shadow-lg border border-border/50">
                <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">💬 Your Suggestions</div>
                <textarea
                  value={userSuggestions}
                  onChange={e => setUserSuggestions(e.target.value)}
                  placeholder="E.g. Make the kitchen larger, add a balcony, move bedroom to the east side..."
                  className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground text-[12.5px] h-[80px] resize-y placeholder:text-muted-foreground"
                />
              </div>

              {/* Generate button */}
              <button
                onClick={generateFloorplan}
                disabled={!analysis}
                className="w-full bg-primary text-primary-foreground rounded-xl py-3 px-4 text-sm font-bold cursor-pointer border-none shadow-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Generate Redesigned Floor Plan
                {selectedAiSuggestions.length > 0 && (
                  <span className="bg-primary-foreground/20 text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full ml-1">
                    {selectedAiSuggestions.length} AI + {userSuggestions.trim() ? "1 user" : "0 user"}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionBtn({ children, onClick, disabled = false, variant, icon }: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary";
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg py-2 px-3.5 text-[12.5px] font-semibold cursor-pointer transition-all disabled:opacity-60 disabled:cursor-not-allowed border-none flex items-center gap-1.5 ${
        variant === "primary"
          ? "bg-primary text-primary-foreground hover:opacity-90"
          : "bg-muted text-foreground hover:bg-muted/80"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
