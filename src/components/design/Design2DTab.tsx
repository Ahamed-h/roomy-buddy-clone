import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Upload, Sparkles, LayoutGrid, Loader2, ImageIcon } from "lucide-react";

const STYLE_OPTIONS = [
  { value: "modern", label: "Modern" },
  { value: "scandinavian", label: "Scandinavian" },
  { value: "industrial", label: "Industrial" },
  { value: "minimalist", label: "Minimalist" },
  { value: "boho", label: "Boho" },
];

const API_BASE = "http://localhost:8000";

export function Design2DTab() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [inputImage, setInputImage] = useState<File | null>(null);
  const [inputPreview, setInputPreview] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState("modern");
  const [outputImageUrl, setOutputImageUrl] = useState<string | null>(null);
  const [templates, setTemplates] = useState<string[]>([]);
  const [redesignLoading, setRedesignLoading] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setInputImage(file);
      setInputPreview(URL.createObjectURL(file));
      setOutputImageUrl(null);
      setTemplates([]);
    }
  };

  const handleRedesignClick = async () => {
    if (!inputImage || !selectedStyle) {
      toast({ title: "Missing input", description: "Please upload an image and select a style." });
      return;
    }
    setRedesignLoading(true);
    setOutputImageUrl(null);
    setTemplates([]);
    try {
      const formData = new FormData();
      formData.append("file", inputImage);
      formData.append("style_prompt", selectedStyle);
      const resp = await fetch(`${API_BASE}/design/generate/2d/repaint`, {
        method: "POST",
        body: formData,
      });
      if (!resp.ok) throw new Error(`Server error: ${resp.status}`);
      const data = await resp.json();
      setOutputImageUrl(data.image_url);
      toast({ title: "Redesign complete!" });
    } catch (err: any) {
      toast({ title: "Redesign failed", description: err.message || "Could not reach the backend.", variant: "destructive" });
    } finally {
      setRedesignLoading(false);
    }
  };

  const handleShowTemplatesClick = async () => {
    if (!selectedStyle) return;
    setTemplatesLoading(true);
    setOutputImageUrl(null);
    setTemplates([]);
    try {
      const resp = await fetch(`${API_BASE}/design/templates?style=${encodeURIComponent(selectedStyle)}`);
      if (!resp.ok) throw new Error(`Server error: ${resp.status}`);
      const data = await resp.json();
      setTemplates(data.images || []);
      if (!data.images?.length) toast({ title: "No templates found for this style." });
    } catch (err: any) {
      toast({ title: "Templates failed", description: err.message || "Could not reach the backend.", variant: "destructive" });
    } finally {
      setTemplatesLoading(false);
    }
  };

  return (
    <div className="container max-w-6xl py-8">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Controls */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Upload Room Photo</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-8 transition-colors hover:border-primary/40"
                onClick={() => fileRef.current?.click()}
              >
                {inputPreview ? (
                  <img src={inputPreview} alt="Input room" className="max-h-48 rounded-lg object-contain" />
                ) : (
                  <>
                    <Upload className="mb-3 h-10 w-10 text-muted-foreground" />
                    <p className="text-sm font-medium">Click to upload a room photo</p>
                    <p className="mt-1 text-xs text-muted-foreground">JPG / PNG, up to 10 MB</p>
                  </>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Target Style</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={selectedStyle} onValueChange={setSelectedStyle}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a style" />
                </SelectTrigger>
                <SelectContent>
                  {STYLE_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex gap-3">
                <Button onClick={handleRedesignClick} disabled={redesignLoading || !inputImage} className="flex-1">
                  {redesignLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Redesign This Room
                </Button>
                <Button variant="outline" onClick={handleShowTemplatesClick} disabled={templatesLoading} className="flex-1">
                  {templatesLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LayoutGrid className="mr-2 h-4 w-4" />}
                  Show Style Templates
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Preview / Output */}
        <div className="space-y-6">
          {inputPreview && (
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-lg">Input Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <img src={inputPreview} alt="Input room" className="w-full rounded-lg" />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Output</CardTitle>
            </CardHeader>
            <CardContent>
              {outputImageUrl ? (
                <img src={outputImageUrl} alt="Redesigned room" className="w-full rounded-lg" />
              ) : templates.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {templates.map((url, i) => (
                    <img key={i} src={url} alt={`Template ${i + 1}`} className="rounded-lg border border-border" />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
                  <ImageIcon className="mb-3 h-10 w-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Generated design will appear here</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
