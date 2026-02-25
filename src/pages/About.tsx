import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { motion } from "framer-motion";
import {
  Box, Brain, Eye, Layers, Palette, Ruler, Sparkles, Camera,
  Code, Server, Upload, Paintbrush, Users
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.5 },
  }),
};

const models = [
  { icon: Eye, name: "YOLO v26n", desc: "Real-time object detection for furniture & room elements" },
  { icon: Eye, name: "OWL-ViT", desc: "Open-vocabulary detection for interior-specific objects (bed, sofa, chair, table, lamp, window, rug, cabinet)" },
  { icon: Layers, name: "SAM (vit_h)", desc: "Segment Anything Model — high-quality segmentation masks" },
  { icon: Palette, name: "CLIP (ViT-B/32)", desc: "Zero-shot material classification (wood, fabric, metal, glass, marble, plastic)" },
  { icon: Ruler, name: "MiDaS (small)", desc: "Monocular depth estimation for spatial understanding" },
  { icon: Sparkles, name: "Custom ViT Aesthetic", desc: "FeaturePredictor (vit_small_patch16_224) + RankingModel → 13 metrics + overall aesthetic score" },
  { icon: Brain, name: "TensorFlow Trait Model", desc: "full_style_trait_model_v2.keras — predicts lighting traits from room images" },
  { icon: Paintbrush, name: "Style Inference Engine", desc: "Rule-based matching via trait_rules.json across 19 interior styles" },
  { icon: Code, name: "Perception Correction", desc: "Post-processing corrections for hierarchy, cohesion, texture, symmetry, clutter" },
  { icon: Camera, name: "Gemini Vision Cross-Check", desc: "Optional secondary analysis to compare/validate model outputs" },
];

const steps = [
  {
    num: "01", title: "Upload Your Room",
    desc: "Take a photo of any room. Supports JPG/PNG up to 10MB. The image is sent to your ML pipeline on HF Spaces."
  },
  {
    num: "02", title: "AI Evaluates & Scores",
    desc: "Your actual models (YOLO, CLIP, MiDaS, ViT, TF) analyze the room. Returns 13 design metrics, detected objects, materials, depth, and style."
  },
  {
    num: "03", title: "Get Redesign + 3D Layout",
    desc: "Gemini generates a photorealistic redesign. A multi-agent pipeline creates a 3D furniture layout you can edit."
  },
  {
    num: "04", title: "Edit in Design Studio",
    desc: "Fine-tune in the dark-themed 3D editor. Add real furniture from photos or the marketplace. Render photorealistic views."
  },
];

const hfSteps = [
  "Create a free Hugging Face account at huggingface.co",
  "Click \"New Space\" → Name it (e.g., roomform-api)",
  "Select SDK: \"Docker\" → Hardware: \"T4 GPU (free)\"",
  "Upload the files from the huggingface/ folder in this project",
  "Upload your model weights to the models/ folder in the Space",
  "Wait for the Space to build (5-10 minutes first time)",
  "Copy your Space URL — it looks like: https://your-name-roomform-api.hf.space",
  "Paste the URL in the Evaluate page settings",
];

const About = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Header */}
      <section className="border-b border-border py-20">
        <div className="container text-center">
          <motion.h1
            className="font-display text-4xl font-bold md:text-5xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            About roomform<span className="text-primary">.ai</span>
          </motion.h1>
          <motion.p
            className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            An AI-powered interior design platform that uses real machine learning models — not approximations — to evaluate, redesign, and furnish your space.
          </motion.p>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="container">
          <h2 className="mb-12 text-center font-display text-3xl font-bold">How It Works</h2>
          <div className="grid gap-8 md:grid-cols-2">
            {steps.map((s, i) => (
              <motion.div
                key={s.num}
                className="rounded-xl border border-border bg-card p-8"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
              >
                <span className="font-display text-5xl font-bold text-primary/15">{s.num}</span>
                <h3 className="mt-2 font-display text-xl font-semibold">{s.title}</h3>
                <p className="mt-3 text-muted-foreground">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Models */}
      <section className="border-t border-border bg-muted/30 py-20">
        <div className="container">
          <h2 className="mb-4 text-center font-display text-3xl font-bold">AI Models & Algorithms</h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-muted-foreground">
            These are the actual models running on your Hugging Face Spaces backend — not proxied through Gemini.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {models.map((m, i) => (
              <motion.div
                key={m.name}
                className="flex gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/30"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <m.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display font-semibold">{m.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{m.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* HF Spaces Guide */}
      <section className="py-20">
        <div className="container max-w-3xl">
          <div className="flex items-center gap-3 mb-8">
            <Server className="h-6 w-6 text-primary" />
            <h2 className="font-display text-3xl font-bold">Deploy to Hugging Face Spaces</h2>
          </div>
          <p className="mb-8 text-muted-foreground">
            Your ML models run on HF Spaces with a free T4 GPU. Follow these steps to deploy:
          </p>
          <ol className="space-y-4">
            {hfSteps.map((step, i) => (
              <motion.li
                key={i}
                className="flex gap-4 rounded-lg border border-border bg-card p-4"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <span className="text-sm">{step}</span>
              </motion.li>
            ))}
          </ol>
        </div>
      </section>

      {/* Created By */}
      <section className="border-t border-border bg-muted/30 py-20">
        <div className="container text-center">
          <Users className="mx-auto mb-4 h-8 w-8 text-primary" />
          <h2 className="font-display text-3xl font-bold">Created By</h2>
          <div className="mx-auto mt-8 grid max-w-md gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-display text-lg font-semibold">Ahamed H</h3>
              <p className="mt-1 text-sm text-muted-foreground">Roll No: 220071601018</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-display text-lg font-semibold">Aashif M</h3>
              <p className="mt-1 text-sm text-muted-foreground">Roll No: 220071601003</p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default About;
