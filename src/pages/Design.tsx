import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Paintbrush, Box, Save } from "lucide-react";
import Design2DTab from "@/components/design/Design2DTab";
import Studio3DEditor from "@/components/design/studio3d/Studio3DEditor";
import { useAuth } from "@/contexts/AuthContext";
import { saveDesign } from "@/lib/designs";
import { useToast } from "@/hooks/use-toast";

const Design = () => {
  const [activeTab, setActiveTab] = useState("2d");
  const { user } = useAuth();
  const { toast } = useToast();

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
            {user && (
              <Button variant="outline" onClick={handleSaveDesign} className="border-border/50 hover:border-primary/30">
                <Save className="mr-2 h-4 w-4" /> Save Design
              </Button>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 grid w-full max-w-md grid-cols-2 bg-muted/50 backdrop-blur-sm">
            <TabsTrigger value="2d" className="gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Paintbrush className="h-4 w-4" /> 2D Design Generation
            </TabsTrigger>
            <TabsTrigger value="3d" className="gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Box className="h-4 w-4" /> Floor Plan Analyzer
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
