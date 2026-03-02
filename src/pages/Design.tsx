import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Paintbrush, Box, Save, Settings, Key } from "lucide-react";
import Design2DTab from "@/components/design/Design2DTab";
import Studio3DEditor from "@/components/design/studio3d/Studio3DEditor";
import { useAuth } from "@/contexts/AuthContext";
import { saveDesign } from "@/lib/designs";
import { useToast } from "@/hooks/use-toast";
import { setGeminiKey, setOpenAIKey } from "@/services/directAI";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const Design = () => {
  const [activeTab, setActiveTab] = useState("2d");
  const { user } = useAuth();
  const { toast } = useToast();
  const [showSettings, setShowSettings] = useState(false);
  const [geminiInput, setGeminiInput] = useState(localStorage.getItem("aivo_gemini_key") || "");
  const [openaiInput, setOpenaiInput] = useState(localStorage.getItem("aivo_openai_key") || "");

  const handleSaveDesign = async () => {
    if (!user) {
      toast({ title: "Sign in to save designs", description: "Use Google Sign In to save your work." });
      return;
    }
    try {
      await saveDesign({
        type: activeTab === "2d" ? "2d" : "3d",
        name: `${activeTab === "2d" ? "2D" : "3D"} Design – ${new Date().toLocaleDateString()}`,
        data: { tab: activeTab },
      });
      toast({ title: "Design saved!", description: "View it in your dashboard." });
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />

      <div className="container py-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Design Studio</h1>
            <p className="mt-1 text-muted-foreground">
              Transform your room with AI‑powered design tools.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setShowSettings(!showSettings)} title="API Key Settings">
              <Settings className="h-4 w-4" />
            </Button>
            {user && (
              <Button variant="outline" onClick={handleSaveDesign} className="border-border/50 hover:border-primary/30">
                <Save className="mr-2 h-4 w-4" /> Save Design
              </Button>
            )}
          </div>
        </div>

        {/* API Key Settings */}
        <Collapsible open={showSettings} onOpenChange={setShowSettings}>
          <CollapsibleContent>
            <div className="mb-6 rounded-lg border border-border/50 bg-muted/20 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Key className="h-4 w-4" /> Direct API Keys (bypasses Supabase)
              </div>
              <p className="text-xs text-muted-foreground">
                If Supabase edge functions are blocked in your region, add your API keys here for direct calls. Keys are stored locally in your browser.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Google Gemini API Key</Label>
                  <Input
                    type="password"
                    placeholder="AIzaSy..."
                    value={geminiInput}
                    onChange={(e) => setGeminiInput(e.target.value)}
                    onBlur={() => { setGeminiKey(geminiInput); toast({ title: "Gemini key saved" }); }}
                    className="bg-background/50 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">OpenAI API Key</Label>
                  <Input
                    type="password"
                    placeholder="sk-..."
                    value={openaiInput}
                    onChange={(e) => setOpenaiInput(e.target.value)}
                    onBlur={() => { setOpenAIKey(openaiInput); toast({ title: "OpenAI key saved" }); }}
                    className="bg-background/50 text-xs"
                  />
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 grid w-full max-w-md grid-cols-2 bg-muted/50 backdrop-blur-sm">
            <TabsTrigger value="2d" className="gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Paintbrush className="h-4 w-4" /> 2D Design Generation
            </TabsTrigger>
            <TabsTrigger value="3d" className="gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Box className="h-4 w-4" /> 3D Design
              <span className="ml-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">Soon</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="2d">
            <Design2DTab />
          </TabsContent>

          <TabsContent value="3d">
            <Studio3DEditor />
          </TabsContent>
        </Tabs>
      </div>

      <Footer />
    </div>
  );
};

export default Design;
