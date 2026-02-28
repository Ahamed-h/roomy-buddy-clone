import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Paintbrush, Box } from "lucide-react";
import Design2DTab from "@/components/design/Design2DTab";
import Studio3DEditor from "@/components/design/studio3d/Studio3DEditor";

const Design = () => {
  const [activeTab, setActiveTab] = useState("2d");

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container py-12">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold">Design Studio</h1>
          <p className="mt-1 text-muted-foreground">
            Transform your room with AI‑powered design tools.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="2d" className="gap-2">
              <Paintbrush className="h-4 w-4" /> 2D Design Generation
            </TabsTrigger>
            <TabsTrigger value="3d" className="gap-2">
              <Box className="h-4 w-4" /> 3D Design
              <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Soon</span>
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
