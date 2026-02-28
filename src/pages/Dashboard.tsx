import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { fetchDesigns, deleteDesign, duplicateDesign, type Design } from "@/lib/designs";
import { motion } from "framer-motion";
import {
  Sparkles, Paintbrush, Box, Trash2, Copy, Pencil,
  Plus, Loader2, ImageIcon
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const typeIcons = { evaluate: Sparkles, "2d": Paintbrush, "3d": Box } as const;
const typeLabels = { evaluate: "Evaluation", "2d": "2D Design", "3d": "3D Design" } as const;

const Dashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [designs, setDesigns] = useState<Design[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setDesigns(await fetchDesigns());
    } catch {
      toast({ title: "Error loading designs", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    try {
      await deleteDesign(id);
      setDesigns((d) => d.filter((x) => x.id !== id));
      toast({ title: "Design deleted" });
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      const copy = await duplicateDesign(id);
      setDesigns((d) => [copy, ...d]);
      toast({ title: "Design duplicated" });
    } catch {
      toast({ title: "Duplicate failed", variant: "destructive" });
    }
  };

  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Designer";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold">Welcome, {displayName}</h1>
            <p className="mt-1 text-muted-foreground">Manage your saved designs and start new projects.</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <Button variant="outline" className="h-auto flex-col gap-2 py-6" onClick={() => navigate("/evaluate")}>
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="font-display font-semibold">Quick Evaluate</span>
            <span className="text-xs text-muted-foreground">Analyze a room photo</span>
          </Button>
          <Button variant="outline" className="h-auto flex-col gap-2 py-6" onClick={() => navigate("/design")}>
            <Paintbrush className="h-6 w-6 text-primary" />
            <span className="font-display font-semibold">New 2D Design</span>
            <span className="text-xs text-muted-foreground">AI-powered redesign</span>
          </Button>
          <Button variant="outline" className="h-auto flex-col gap-2 py-6" onClick={() => navigate("/design")}>
            <Box className="h-6 w-6 text-primary" />
            <span className="font-display font-semibold">New 3D Design</span>
            <span className="text-xs text-muted-foreground">3D room editor</span>
          </Button>
        </div>

        {/* Designs Grid */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-semibold">My Designs ({designs.length})</h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : designs.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-20 text-center">
              <ImageIcon className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="font-display text-lg font-semibold">No designs yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">Get started by evaluating a room or creating a new design.</p>
              <Button className="mt-4" onClick={() => navigate("/evaluate")}>
                <Plus className="mr-2 h-4 w-4" /> Create Your First Design
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {designs.map((design, i) => {
              const Icon = typeIcons[design.type] || Sparkles;
              return (
                <motion.div
                  key={design.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className="group overflow-hidden transition-shadow hover:shadow-lg">
                    {/* Thumbnail */}
                    <div className="relative aspect-video bg-muted">
                      {design.thumbnail_url ? (
                        <img src={design.thumbnail_url} alt={design.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Icon className="h-10 w-10 text-muted-foreground/40" />
                        </div>
                      )}
                      <div className="absolute left-2 top-2">
                        <span className="rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-medium backdrop-blur-sm">
                          {typeLabels[design.type]}
                        </span>
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-display font-semibold truncate">{design.name}</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {new Date(design.created_at).toLocaleDateString()}
                      </p>
                      <div className="mt-3 flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/design?id=${design.id}`)}>
                          <Pencil className="mr-1 h-3 w-3" /> Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDuplicate(design.id)}>
                          <Copy className="mr-1 h-3 w-3" /> Duplicate
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                              <Trash2 className="mr-1 h-3 w-3" /> Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete design?</AlertDialogTitle>
                              <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(design.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default Dashboard;
