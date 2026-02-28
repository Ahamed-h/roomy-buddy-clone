import { useState, useCallback } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import {
  Upload, Settings, BarChart3, Eye, Sparkles, ArrowRight,
  Download, Info, Loader2, ImageIcon, Layers, Save
} from "lucide-react";
import { analyzeRoom, getMockResult, getHfSpacesUrl, setHfSpacesUrl, type AnalysisResult } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { saveDesign } from "@/lib/designs";

const Evaluate = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [hfUrl, setHfUrl] = useState(getHfSpacesUrl());
  const [showSettings, setShowSettings] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const runAnalysis = async () => {
    if (!image) return;
    setLoading(true);
    try {
      const data = await analyzeRoom(image);
      setResult(data);
      sessionStorage.setItem("aivo_analysis", JSON.stringify(data));
      if (imagePreview) sessionStorage.setItem("aivo_image", imagePreview);
      toast({ title: "Analysis complete!", description: "Your room has been evaluated." });
    } catch {
      toast({
        title: "Using demo data",
        description: "Backend not connected. Showing mock analysis results.",
      });
      const mock = getMockResult();
      setResult(mock);
      sessionStorage.setItem("aivo_analysis", JSON.stringify(mock));
      if (imagePreview) sessionStorage.setItem("aivo_image", imagePreview);
    } finally {
      setLoading(false);
    }
  };

  // Helper to get brightness from either new or legacy format
  const getBrightness = (r: AnalysisResult) => r.lighting?.brightness ?? r.brightness ?? 0;

  // Style scores: prefer new format, fall back to legacy
  const getStyleScores = (r: AnalysisResult): Array<{ style: string; score: number }> => {
    if (r.style_match_scores && Object.keys(r.style_match_scores).length > 0) {
      return Object.entries(r.style_match_scores)
        .map(([style, score]) => ({ style, score: score as number }))
        .sort((a, b) => b.score - a.score);
    }
    return r.top_styles || [];
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container py-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold">AI Room Evaluation</h1>
            <p className="mt-1 text-muted-foreground">Upload a room photo to analyze with real ML models.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowSettings(!showSettings)}>
            <Settings className="mr-2 h-4 w-4" /> Settings
          </Button>
        </div>

        {/* Settings */}
        {showSettings && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <label className="text-sm font-medium">Local ML Server URL</label>
              <div className="mt-2 flex gap-2">
                <Input
                  value={hfUrl}
                  onChange={(e) => setHfUrl(e.target.value)}
                  placeholder="http://localhost:8000"
                />
                <Button onClick={() => { setHfSpacesUrl(hfUrl); toast({ title: "Saved!" }); }}>
                  Save
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Your local ML server URL. Default: http://localhost:8000.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Upload */}
        {!result && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-card p-16 transition-colors hover:border-primary/40"
            >
              {imagePreview ? (
                <div className="w-full max-w-2xl space-y-4">
                  <img src={imagePreview} alt="Room preview" className="w-full rounded-lg" />
                  <div className="flex justify-center gap-3">
                    <Button variant="outline" onClick={() => { setImage(null); setImagePreview(null); }}>
                      Change Photo
                    </Button>
                    <Button onClick={runAnalysis} disabled={loading}>
                      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                      {loading ? "Analyzing..." : "Run AI Evaluation"}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="mb-4 h-12 w-12 text-muted-foreground" />
                  <h2 className="font-display text-xl font-semibold">Upload your room photo</h2>
                  <p className="mt-2 text-sm text-muted-foreground">Drag & drop or click to browse. JPG/PNG, up to 10MB.</p>
                  <label className="mt-4 cursor-pointer">
                    <Button asChild><span>Choose File</span></Button>
                    <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                  </label>
                </>
              )}
            </div>
          </motion.div>
        )}

        {/* Results Dashboard */}
        {result && (
          <motion.div className="space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Back + actions */}
            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => { setResult(null); setImage(null); setImagePreview(null); }}>
                ← New Analysis
              </Button>
              <div className="flex gap-2">
                {user && (
                  <Button variant="outline" size="sm" onClick={async () => {
                    try {
                      await saveDesign({
                        type: "evaluate",
                        name: `Evaluation – ${new Date().toLocaleDateString()}`,
                        thumbnail_url: imagePreview || null,
                        data: result as unknown as Record<string, unknown>,
                      });
                      toast({ title: "Evaluation saved!", description: "View it in your dashboard." });
                    } catch { toast({ title: "Save failed", variant: "destructive" }); }
                  }}>
                    <Save className="mr-2 h-4 w-4" /> Save to Profile
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => {
                  const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url; a.download = "aivo-analysis.json"; a.click();
                }}>
                  <Download className="mr-2 h-4 w-4" /> Download JSON
                </Button>
                <Button size="sm" asChild>
                  <a href="/design"><ArrowRight className="mr-2 h-4 w-4" /> Open in Design Studio</a>
                </Button>
              </div>
            </div>

            {/* Metric Cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Sparkles className="h-4 w-4 text-primary" /> Aesthetic Score
                  </div>
                  <p className="mt-2 font-display text-4xl font-bold">{result.aesthetic_score.toFixed(1)}<span className="text-lg text-muted-foreground">/10</span></p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Eye className="h-4 w-4" /> Brightness
                  </div>
                  <p className="mt-2 font-display text-4xl font-bold">{getBrightness(result)}<span className="text-lg text-muted-foreground">%</span></p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <BarChart3 className="h-4 w-4" /> Objects Detected
                  </div>
                  <p className="mt-2 font-display text-4xl font-bold">{result.objects.length}</p>
                </CardContent>
              </Card>
            </div>

            {/* Room photo */}
            {imagePreview && (
              <Card>
                <CardContent className="pt-6">
                  <img src={imagePreview} alt="Analyzed room" className="w-full rounded-lg" />
                </CardContent>
              </Card>
            )}

            {/* Style Matches */}
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-lg">Style Match Scores</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {getStyleScores(result).map((s) => (
                  <div key={s.style}>
                    <div className="flex justify-between text-sm">
                      <span>{s.style}</span>
                      <span className="text-muted-foreground">{Math.round(s.score * 100)}%</span>
                    </div>
                    <Progress value={s.score * 100} className="mt-1 h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Objects Table */}
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-lg">Detected Objects</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="p-2 text-left font-medium">Object</th>
                        <th className="p-2 text-left font-medium">Confidence</th>
                        <th className="p-2 text-left font-medium">Material</th>
                        <th className="p-2 text-left font-medium">Distance</th>
                        <th className="p-2 text-left font-medium">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.objects.map((obj, i) => (
                        <tr key={i} className="border-b border-border/50">
                          <td className="p-2 capitalize font-medium">{obj.name || (obj as any).label}</td>
                          <td className="p-2">{(obj.confidence * 100).toFixed(0)}%</td>
                          <td className="p-2"><Badge variant="secondary" className="capitalize">{obj.material}</Badge></td>
                          <td className="p-2">{(obj.distance_m ?? (obj as any).distance ?? 0).toFixed(1)}m</td>
                          <td className="p-2"><Badge variant="outline">{obj.source}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Depth Map indicator */}
            {result.depth_map && result.depth_map.length > 0 && (
              <Card>
                <CardContent className="flex items-center gap-3 pt-6">
                  <Layers className="h-5 w-5 text-primary" />
                  <p className="text-sm font-medium">Depth map available ({result.depth_map.length}×{result.depth_map[0]?.length || 0} pixels)</p>
                </CardContent>
              </Card>
            )}

            {/* Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-lg">AI Recommendations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {result.recommendations.map((tip, i) => (
                  <div key={i} className="flex gap-3 rounded-lg border border-border bg-muted/30 p-4">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <p className="text-sm">{tip}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default Evaluate;
