import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { motion } from "framer-motion";
import {
  Box, Brain, Eye, Layers, Palette, Ruler, Sparkles, Camera,
  Code, Paintbrush, Users, Target, Zap, ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.5 },
  }),
};

const models = [
  { icon: Eye, name: "YOLO v26n", desc: "Real-time object detection for furniture & room elements" },
  { icon: Eye, name: "OWL-ViT", desc: "Open-vocabulary detection — bed, sofa, chair, table, lamp, window, rug, cabinet" },
  { icon: Layers, name: "SAM (vit_b)", desc: "Segment Anything Model — lightweight segmentation masks optimized for CPU" },
  { icon: Palette, name: "CLIP (ViT-B/32)", desc: "Zero-shot material classification — wood, fabric, metal, glass, marble, plastic" },
  { icon: Ruler, name: "MiDaS (small)", desc: "Monocular depth estimation for spatial understanding and 3D reconstruction" },
  { icon: Sparkles, name: "Custom ViT Aesthetic", desc: "FeaturePredictor + RankingModel → 13 design metrics + overall aesthetic score" },
  { icon: Brain, name: "TensorFlow Trait Model", desc: "Predicts lighting traits from room images for accurate style inference" },
  { icon: Paintbrush, name: "Style Inference Engine", desc: "Rule-based matching via trait_rules.json across 19 interior design styles" },
  { icon: Code, name: "Perception Correction", desc: "Post-processing for hierarchy, cohesion, texture, symmetry, and clutter balance" },
  { icon: Camera, name: "Vision Cross-Check", desc: "Optional secondary analysis to compare and validate model outputs" },
];

const capabilities = [
  {
    icon: Target,
    title: "Room Evaluation",
    desc: "Upload a photo → get 13 scored design metrics, detected objects with bounding boxes, material analysis, depth maps, and style classification from 19 categories.",
  },
  {
    icon: Layers,
    title: "Floor Plan Analysis",
    desc: "Upload a 2D floor plan → AI detects rooms, walls, doors, and windows. Get optimization suggestions, add your own ideas, and generate a redesigned floor plan.",
  },
  {
    icon: Paintbrush,
    title: "3D Design Studio",
    desc: "Dark-themed 3D editor with furniture placement, real-time manipulation, photorealistic rendering, and an AI chat assistant that sees your space.",
  },
  {
    icon: Camera,
    title: "Furniture from Photos",
    desc: "Take a photo of any real furniture piece. AI converts it to a to-scale 3D model you can place directly in your room design.",
  },
];

const About = () => {
  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Header */}
      <section className="relative overflow-hidden py-24 md:py-32">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,107,53,0.08),transparent_70%)]" />
        <div className="container relative text-center">
          <motion.span
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary backdrop-blur-sm"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Box className="h-3.5 w-3.5" />
            About the Platform
          </motion.span>
          <motion.h1
            className="mt-4 font-display text-4xl font-extrabold md:text-6xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            What is <span className="gradient-text">aivo.ai</span>?
          </motion.h1>
          <motion.p
            className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            An AI-powered interior design platform that uses real machine learning models to evaluate rooms,
            analyze floor plans, generate redesigns, and help you shop for real furniture — all from a single interface.
          </motion.p>
        </div>
      </section>

      {/* What It Does */}
      <section className="border-t border-border/30 py-24">
        <div className="container">
          <motion.div className="mb-16 text-center" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <h2 className="font-display text-3xl font-bold text-foreground">What It Does</h2>
            <p className="mt-3 text-muted-foreground">Four core capabilities, one unified platform.</p>
          </motion.div>
          <div className="grid gap-6 md:grid-cols-2">
            {capabilities.map((c, i) => (
              <motion.div
                key={c.title}
                className="glass-card rounded-xl p-8"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <c.icon className="h-6 w-6" />
                </div>
                <h3 className="font-display text-xl font-semibold text-foreground">{c.title}</h3>
                <p className="mt-3 text-muted-foreground leading-relaxed">{c.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Models */}
      <section className="py-24">
        <div className="container">
          <motion.div className="mb-4 text-center" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <h2 className="font-display text-3xl font-bold text-foreground">AI Models Under the Hood</h2>
          </motion.div>
          <motion.p
            className="mx-auto mb-12 max-w-2xl text-center text-muted-foreground"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={1}
          >
            10 specialized models optimized for CPU inference — no GPU required.
          </motion.p>
          <div className="grid gap-4 md:grid-cols-2">
            {models.map((m, i) => (
              <motion.div
                key={m.name}
                className="glass-card flex gap-4 rounded-xl p-5"
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
                  <h3 className="font-display font-semibold text-foreground">{m.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{m.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="border-t border-border/30 py-24">
        <div className="container max-w-3xl">
          <motion.div className="mb-12 text-center" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <h2 className="font-display text-3xl font-bold text-foreground">Tech Stack</h2>
          </motion.div>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { label: "Frontend", value: "React + TypeScript + Tailwind + Three.js" },
              { label: "ML Server", value: "Python FastAPI — CPU-optimized models" },
              { label: "3D Engine", value: "React Three Fiber + Drei" },
              { label: "Floor Plans", value: "Konva canvas + AI analysis pipeline" },
              { label: "Image Gen", value: "AI Vision models + optional ComfyUI" },
              { label: "LLM Chat", value: "Ollama (local) or cloud AI (optional)" },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                className="glass-card-static rounded-xl p-5"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
              >
                <span className="text-xs font-bold uppercase tracking-widest text-primary/60">{item.label}</span>
                <p className="mt-1 text-sm text-foreground">{item.value}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Created By */}
      <section className="py-24">
        <div className="container text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <Users className="mx-auto mb-4 h-8 w-8 text-primary" />
            <h2 className="font-display text-3xl font-bold text-foreground">Created By</h2>
          </motion.div>
          <div className="mx-auto mt-8 grid max-w-md gap-6 md:grid-cols-2">
            <motion.div className="glass-card rounded-xl p-6" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
              <h3 className="font-display text-lg font-semibold text-foreground">Ahamed H</h3>
              <p className="mt-1 text-sm text-muted-foreground">Roll No: 220071601018</p>
            </motion.div>
            <motion.div className="glass-card rounded-xl p-6" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={1}>
              <h3 className="font-display text-lg font-semibold text-foreground">Aashif M</h3>
              <p className="mt-1 text-sm text-muted-foreground">Roll No: 220071601003</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/30 py-24">
        <div className="container">
          <motion.div
            className="glass-card rounded-2xl p-12 text-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
          >
            <Zap className="mx-auto mb-4 h-8 w-8 text-primary" />
            <h2 className="font-display text-3xl font-bold text-foreground">Try it yourself</h2>
            <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
              Upload a room photo or floor plan and experience AI-powered interior design.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Button size="lg" className="btn-premium px-8" asChild>
                <Link to="/evaluate">Evaluate a Room <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <Button size="lg" variant="outline" className="border-border/50 bg-muted/30 backdrop-blur-sm hover:bg-muted/50" asChild>
                <Link to="/design">Open Design Studio</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default About;
