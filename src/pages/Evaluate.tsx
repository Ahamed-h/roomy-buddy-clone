import { useState, useCallback } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import {
  Upload, Settings, BarChart3, Eye, Palette, Sparkles, ArrowRight,
  Download, Info, Loader2, ImageIcon
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from "recharts";
import { analyzeRoom, getMockResult, getHfSpacesUrl, setHfSpacesUrl, type AnalysisResult } from "@/services/api";

const CHART_COLORS = ["hsl(152,60%,42%)", "hsl(200,60%,50%)", "hsl(45,80%,55%)", "hsl(280,50%,55%)", "hsl(0,60%,55%)"];

const Evaluate = () => {
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
      // Store for Design Studio
      sessionStorage.setItem("roomform_analysis", JSON.stringify(data));
      if (imagePreview) sessionStorage.setItem("roomform_image", imagePreview);
      toast({ title: "Analysis complete!", description: "Your room has been evaluated." });
    } catch {
      toast({
        title: "Using demo data",
        description: "HF Spaces not connected. Showing mock analysis results.",
      });
      const mock = getMockResult();
      setResult(mock);
      sessionStorage.setItem("roomform_analysis", JSON.stringify(mock));
      if (imagePreview) sessionStorage.setItem("roomform_image", imagePreview);
    } finally {
      setLoading(false);
    }
  };

  const metricsData = result
    ? Object.entries(result.design_metrics).map(([key, value]) => ({
        name: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        value: value as number,
        fullMark: 10,
      }))
    : [];

  const styleData = result
    ? result.top_styles.map((s) => ({ name: s.style, score: Math.round(s.score * 100) }))
    : [];

  const materialData = result
    ? Object.entries(result.material_distribution).map(([name, value]) => ({ name, value }))
    : [];

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
              <label className="text-sm font-medium">HF Spaces API URL</label>
              <div className="mt-2 flex gap-2">
                <Input
                  value={hfUrl}
                  onChange={(e) => setHfUrl(e.target.value)}
                  placeholder="https://your-space.hf.space"
                />
                <Button onClick={() => { setHfSpacesUrl(hfUrl); toast({ title: "Saved!" }); }}>
                  Save
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Enter your Hugging Face Spaces URL. See the About page for deployment instructions.
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
                      {loading ? "Analyzing..." : "Run AI Analysis"}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="mb-4 h-12 w-12 text-muted-foreground" />
                  <h3 className="font-display text-xl font-semibold">Upload your room photo</h3>
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
                <Button variant="outline" size="sm" onClick={() => {
                  const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url; a.download = "roomform-analysis.json"; a.click();
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
                  <p className="mt-2 font-display text-4xl font-bold">{result.brightness}<span className="text-lg text-muted-foreground">%</span></p>
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

            {/* Room photo + preview */}
            {imagePreview && (
              <Card>
                <CardContent className="pt-6">
                  <img src={imagePreview} alt="Analyzed room" className="w-full rounded-lg" />
                </CardContent>
              </Card>
            )}

            <Tabs defaultValue="style">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="style">Style</TabsTrigger>
                <TabsTrigger value="objects">Objects</TabsTrigger>
                <TabsTrigger value="metrics">Metrics</TabsTrigger>
                <TabsTrigger value="tips">Tips</TabsTrigger>
              </TabsList>

              {/* Style Tab */}
              <TabsContent value="style" className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card>
                    <CardHeader><CardTitle className="font-display">Style Traits</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      {Object.entries(result.style_traits).map(([trait, value]) => (
                        <div key={trait}>
                          <div className="flex justify-between text-sm">
                            <span className="capitalize">{trait.replace(/_/g, " ")}</span>
                            <span className="text-muted-foreground">{((value as number) * 100).toFixed(0)}%</span>
                          </div>
                          <Progress value={(value as number) * 100} className="mt-1 h-2" />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="font-display">Top Style Matches</CardTitle></CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={styleData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                          <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Bar dataKey="score" fill="hsl(152,60%,42%)" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Objects Tab */}
              <TabsContent value="objects" className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-3">
                  <Card className="lg:col-span-2">
                    <CardHeader><CardTitle className="font-display">Detected Objects</CardTitle></CardHeader>
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
                                <td className="p-2 capitalize font-medium">{obj.label}</td>
                                <td className="p-2">{(obj.confidence * 100).toFixed(0)}%</td>
                                <td className="p-2"><Badge variant="secondary" className="capitalize">{obj.material}</Badge></td>
                                <td className="p-2">{obj.distance.toFixed(1)}m</td>
                                <td className="p-2"><Badge variant="outline">{obj.source}</Badge></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="font-display">Materials</CardTitle></CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={materialData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                            {materialData.map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Metrics Tab */}
              <TabsContent value="metrics">
                <Card>
                  <CardHeader><CardTitle className="font-display">Design Metrics (13)</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {metricsData.map((m) => (
                      <div key={m.name}>
                        <div className="flex justify-between text-sm">
                          <span>{m.name}</span>
                          <span className="font-medium">{m.value.toFixed(1)}/10</span>
                        </div>
                        <Progress value={m.value * 10} className="mt-1 h-2" />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tips Tab */}
              <TabsContent value="tips">
                <Card>
                  <CardHeader><CardTitle className="font-display">AI Recommendations</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {result.recommendations.map((tip, i) => (
                      <div key={i} className="flex gap-3 rounded-lg border border-border bg-muted/30 p-4">
                        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <p className="text-sm">{tip}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </motion.div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default Evaluate;
