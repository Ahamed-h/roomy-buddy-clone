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
  Download, Info, Loader2, ImageIcon, Layers, Save, ShieldCheck
} from "lucide-react";
import { analyzeRoom, getHfSpacesUrl, setHfSpacesUrl, type AnalysisResult } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { saveDesign } from "@/lib/designs";
import { supabase } from "@/integrations/supabase/client";

const Evaluate = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [correctionsSummary, setCorrectionsSummary] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
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

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const verifyWithAI = async (analysisResult: AnalysisResult, imageFile: File) => {
    setVerifying(true);
    try {
      const imageBase64 = await fileToBase64(imageFile);
      const { data, error } = await supabase.functions.invoke("verify-analysis", {
        body: { analysisResult, imageBase64 },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Merge corrected results back
      const corrected: AnalysisResult = {
        ...analysisResult,
        aesthetic_score: data.aesthetic_score ?? analysisResult.aesthetic_score,
        lighting: data.lighting ?? analysisResult.lighting,
        objects: data.objects ?? analysisResult.objects,
        style_match_scores: data.style_match_scores ?? analysisResult.style_match_scores,
        possible_styles: data.possible_styles ?? analysisResult.possible_styles,
        recommendations: data.recommendations ?? analysisResult.recommendations,
      };

      // Rebuild legacy fields
      if (corrected.style_match_scores) {
        corrected.top_styles = Object.entries(corrected.style_match_scores)
          .map(([style, score]) => ({ style, score: score as number }))
          .sort((a, b) => b.score - a.score);
      }
      if (corrected.lighting) {
        corrected.brightness = corrected.lighting.brightness;
      }

      setResult(corrected);
      setCorrectionsSummary(data.corrections_summary || null);
      setIsVerified(true);
      sessionStorage.setItem("aivo_analysis", JSON.stringify(corrected));

      toast({ title: "AI Verification Complete!", description: data.corrections_summary || "Results have been cross-checked." });
    } catch (err) {
      console.error("AI verification error:", err);
      toast({
        title: "AI verification failed",
        description: `${err instanceof Error ? err.message : "Unknown error"}. Local results are still shown.`,
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
    }
  };

  const runAnalysis = async () => {
    if (!image) return;
    setLoading(true);
    setIsVerified(false);
    setCorrectionsSummary(null);
    try {
      const data = await analyzeRoom(image);
      setResult(data);
      sessionStorage.setItem("aivo_analysis", JSON.stringify(data));
      if (imagePreview) sessionStorage.setItem("aivo_image", imagePreview);
      toast({ title: "Local analysis complete!", description: "Now cross-checking with AI..." });

      // Auto-run AI verification
      await verifyWithAI(data, image);
    } catch (err) {
      console.error("Analysis fetch error:", err);
      toast({
        title: "Analysis failed",
        description: `Could not reach backend at ${getHfSpacesUrl()}. Error: ${err instanceof Error ? err.message : "unknown"}. Check Settings to verify the URL.`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getBrightness = (r: AnalysisResult) => r.lighting?.brightness ?? r.brightness ?? 0;

  const getStyleScores = (r: AnalysisResult): Array<{ style: string; score: number }> => {
    if (r.style_match_scores && Object.keys(r.style_match_scores).length > 0) {
      return Object.entries(r.style_match_scores)
        .map(([style, score]) => ({ style, score: score as number }))
        .sort((a, b) => b.score - a.score);
    }
    return r.top_styles || [];
  };

  return (
    <div className="min-h-screen">
      <Navbar />

      <div className="container py-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">AI Room Evaluation</h1>
            <p className="mt-1 text-muted-foreground">Upload a room photo to analyze with real ML models, then AI-verified.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowSettings(!showSettings)} className="border-border/50 hover:border-primary/30">
            <Settings className="mr-2 h-4 w-4" /> Settings
          </Button>
        </div>

        {/* Settings */}
        {showSettings && (
          <Card className="mb-6 glass-card-static">
            <CardContent className="pt-6">
              <label className="text-sm font-medium text-foreground">Local ML Server URL</label>
              <div className="mt-2 flex gap-2">
                <Input
                  value={hfUrl}
                  onChange={(e) => setHfUrl(e.target.value)}
                  placeholder="http://localhost:8000"
                  className="bg-muted/50 border-border/50 focus:border-primary/50"
                />
                <Button onClick={() => { setHfSpacesUrl(hfUrl); toast({ title: "Saved!" }); }} className="btn-premium">
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
              className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/50 glass-card-static p-16 transition-all hover:border-primary/40"
            >
              {imagePreview ? (
                <div className="w-full max-w-2xl space-y-4">
                  <img src={imagePreview} alt="Room preview" className="w-full rounded-lg" />
                  <div className="flex justify-center gap-3">
                    <Button variant="outline" className="border-border/50 hover:border-primary/30" onClick={() => { setImage(null); setImagePreview(null); }}>
                      Change Photo
                    </Button>
                    <Button onClick={runAnalysis} disabled={loading} className="btn-premium">
                      {loading ? <div className="orange-spinner mr-2 h-4 w-4" /> : <Sparkles className="mr-2 h-4 w-4" />}
                      {loading ? "Analyzing..." : "Run AI Evaluation"}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="mb-4 h-12 w-12 text-muted-foreground" />
                  <h2 className="font-display text-xl font-semibold text-foreground">Upload your room photo</h2>
                  <p className="mt-2 text-sm text-muted-foreground">Drag & drop or click to browse. JPG/PNG, up to 10MB.</p>
                  <label className="mt-4 cursor-pointer">
                    <Button className="btn-premium" asChild><span>Choose File</span></Button>
                    <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                  </label>
                </>
              )}
            </div>
          </motion.div>
        )}

        {/* Verifying overlay */}
        {verifying && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="my-4">
            <Card className="glass-card border-primary/30 orange-glow">
              <CardContent className="flex items-center gap-3 py-4">
                <div className="orange-spinner h-5 w-5" />
                <p className="text-sm font-medium text-foreground">AI is cross-checking results with the photo...</p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Results Dashboard */}
        {result && (
          <motion.div className="space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Back + actions */}
            <div className="flex items-center justify-between">
              <Button variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={() => { setResult(null); setImage(null); setImagePreview(null); setIsVerified(false); setCorrectionsSummary(null); }}>
                ← New Analysis
              </Button>
              <div className="flex gap-2">
                {isVerified && (
                  <Badge variant="secondary" className="gap-1.5 bg-green-500/10 text-green-600 border-green-500/30">
                    <ShieldCheck className="h-3.5 w-3.5" /> AI Verified
                  </Badge>
                )}
                {user && (
                  <Button variant="outline" size="sm" className="border-border/50 hover:border-primary/30" onClick={async () => {
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
                <Button variant="outline" size="sm" className="border-border/50 hover:border-primary/30" onClick={() => {
                  const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url; a.download = "aivo-analysis.json"; a.click();
                }}>
                  <Download className="mr-2 h-4 w-4" /> Download JSON
                </Button>
                <Button size="sm" className="btn-premium" asChild>
                  <a href="/design"><ArrowRight className="mr-2 h-4 w-4" /> Open in Design Studio</a>
                </Button>
              </div>
            </div>

            {/* AI Corrections Summary */}
            {correctionsSummary && (
              <Card className="glass-card border-primary/20 orange-glow">
                <CardContent className="flex gap-3 pt-6">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">AI Verification Notes</p>
                    <p className="mt-1 text-sm text-muted-foreground">{correctionsSummary}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Metric Cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="glass-card border-primary/20 orange-glow">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Sparkles className="h-4 w-4 text-primary" /> Aesthetic Score
                  </div>
                  <p className="mt-2 font-display text-4xl font-bold text-foreground">{result.aesthetic_score.toFixed(1)}<span className="text-lg text-muted-foreground">/10</span></p>
                </CardContent>
              </Card>
              <Card className="glass-card-static">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Eye className="h-4 w-4" /> Brightness
                  </div>
                  <p className="mt-2 font-display text-4xl font-bold text-foreground">{getBrightness(result)}<span className="text-lg text-muted-foreground">%</span></p>
                </CardContent>
              </Card>
              <Card className="glass-card-static">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <BarChart3 className="h-4 w-4" /> Objects Detected
                  </div>
                  <p className="mt-2 font-display text-4xl font-bold text-foreground">{result.objects.length}</p>
                </CardContent>
              </Card>
            </div>

            {/* Room photo */}
            {imagePreview && (
              <Card className="glass-card-static overflow-hidden">
                <CardContent className="pt-6">
                  <img src={imagePreview} alt="Analyzed room" className="w-full rounded-lg" />
                </CardContent>
              </Card>
            )}

            {/* Style Matches */}
            <Card className="glass-card-static">
              <CardHeader>
                <CardTitle className="font-display text-lg text-foreground">Style Match Scores</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {getStyleScores(result).map((s) => (
                  <div key={s.style}>
                    <div className="flex justify-between text-sm">
                      <span className="text-foreground">{s.style}</span>
                      <span className="text-muted-foreground">{Math.round(s.score * 100)}%</span>
                    </div>
                    <Progress value={s.score * 100} className="mt-1 h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Objects Table */}
            <Card className="glass-card-static">
              <CardHeader>
                <CardTitle className="font-display text-lg text-foreground">Detected Objects</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="p-2 text-left font-medium text-muted-foreground">Object</th>
                        <th className="p-2 text-left font-medium text-muted-foreground">Confidence</th>
                        <th className="p-2 text-left font-medium text-muted-foreground">Material</th>
                        <th className="p-2 text-left font-medium text-muted-foreground">Distance</th>
                        <th className="p-2 text-left font-medium text-muted-foreground">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.objects.map((obj, i) => (
                        <tr key={i} className="border-b border-border/30">
                          <td className="p-2 capitalize font-medium text-foreground">{obj.name || (obj as any).label}</td>
                          <td className="p-2 text-foreground">{(obj.confidence * 100).toFixed(0)}%</td>
                          <td className="p-2"><Badge variant="secondary" className="capitalize">{obj.material}</Badge></td>
                          <td className="p-2 text-foreground">{(obj.distance_m ?? (obj as any).distance ?? 0).toFixed(1)}m</td>
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
              <Card className="glass-card-static">
                <CardContent className="flex items-center gap-3 pt-6">
                  <Layers className="h-5 w-5 text-primary" />
                  <p className="text-sm font-medium text-foreground">Depth map available ({result.depth_map.length}×{result.depth_map[0]?.length || 0} pixels)</p>
                </CardContent>
              </Card>
            )}

            {/* Recommendations */}
            <Card className="glass-card-static">
              <CardHeader>
                <CardTitle className="font-display text-lg text-foreground">AI Recommendations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {result.recommendations.map((tip, i) => (
                  <div key={i} className="flex gap-3 rounded-lg border border-border/30 bg-muted/30 p-4 backdrop-blur-sm">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <p className="text-sm text-foreground">{tip}</p>
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
