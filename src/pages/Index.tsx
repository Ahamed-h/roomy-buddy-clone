import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight, BarChart3, Paintbrush, Camera, Sparkles, Eye,
  ShoppingCart, Share2, Layers, Ruler, Brain, Zap
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" },
  }),
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

const features = [
  {
    icon: BarChart3,
    title: "Room Evaluation",
    desc: "Upload any room photo and get 13 design metrics scored by real ML models running locally.",
  },
  {
    icon: Sparkles,
    title: "Aesthetic Scoring",
    desc: "Custom ViT model rates visual appeal with a professional-grade 0–10 score across multiple dimensions.",
  },
  {
    icon: Eye,
    title: "Style Detection",
    desc: "Identifies your room's style from 19 interior categories using trait-based AI inference.",
  },
  {
    icon: Layers,
    title: "Floor Plan Analysis",
    desc: "Upload a floor plan — AI detects rooms, walls, and doors, then generates an optimized redesign.",
  },
  {
    icon: Paintbrush,
    title: "AI Redesign & Rendering",
    desc: "Get photorealistic redesign suggestions with real lighting, materials, and spatial accuracy.",
  },
  {
    icon: ShoppingCart,
    title: "Furniture Marketplace",
    desc: "Browse real furniture from retailers. Buy direct at listed price — zero markup, zero middleman.",
  },
];

const workflow = [
  { num: "01", title: "Upload", desc: "Take a photo of your room or upload a floor plan.", icon: Camera },
  { num: "02", title: "Analyze", desc: "AI models evaluate lighting, style, objects, depth, and aesthetics.", icon: Brain },
  { num: "03", title: "Redesign", desc: "Get AI-generated redesigns and optimized furniture layouts.", icon: Sparkles },
  { num: "04", title: "Build", desc: "Edit in the 3D studio, add real furniture, and render final views.", icon: Ruler },
];

const stats = [
  { value: "13", label: "Design metrics" },
  { value: "19", label: "Style categories" },
  { value: "10+", label: "AI models" },
  { value: "0%", label: "Markup on furniture" },
];

const faqs = [
  {
    q: "What AI models are used?",
    a: "YOLO v26n for object detection, OWL-ViT for open-vocabulary detection, CLIP for material classification, MiDaS for depth estimation, a custom ViT model for aesthetic scoring, and a TensorFlow model for style prediction. All run locally on CPU.",
  },
  {
    q: "Is the furniture real?",
    a: "Yes — 100% real products from real retailers. Upload a photo of any furniture piece and AI converts it to a to-scale 3D model. Or browse the marketplace and buy direct at the store's listed price.",
  },
  {
    q: "How does floor plan analysis work?",
    a: "Upload a 2D floor plan image. AI detects rooms, walls, and openings, then provides optimization suggestions. You can add your own ideas and generate a redesigned floor plan.",
  },
  {
    q: "Do I need a GPU?",
    a: "No. All ML models are optimized for CPU inference. The local server runs on any machine with Python 3.10+ and ~6 GB of RAM.",
  },
  {
    q: "Who built this?",
    a: "aivo.ai was created by Ahamed H (220071601018) and Aashif M (220071601003).",
  },
];

const Index = () => {
  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,107,53,0.1),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(74,144,226,0.06),transparent_50%)]" />
        <div className="container relative py-28 md:py-40">
          <motion.div
            className="mx-auto max-w-3xl text-center"
            initial="hidden"
            animate="visible"
            variants={stagger}
          >
            <motion.span
              variants={fadeUp}
              custom={0}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary backdrop-blur-sm"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              AI Interior Design Platform
            </motion.span>
            <motion.h1
              variants={fadeUp}
              custom={1}
              className="mt-4 font-display text-5xl font-extrabold leading-[1.1] tracking-tight md:text-7xl"
            >
              Evaluate. Redesign.
              <br />
              <span className="gradient-text">Furnish.</span>
            </motion.h1>
            <motion.p
              variants={fadeUp}
              custom={2}
              className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground leading-relaxed"
            >
              Upload a room photo or floor plan. Get AI-powered evaluation with 13 design metrics,
              photorealistic redesigns, and shop real furniture — all in one studio.
            </motion.p>
            <motion.div
              variants={fadeUp}
              custom={3}
              className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
            >
              <Button size="lg" className="btn-premium px-8 py-6 text-base" asChild>
                <Link to="/evaluate">
                  Start Evaluating <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="border-border/50 bg-muted/30 backdrop-blur-sm hover:bg-muted/50 hover:border-primary/30 transition-all" asChild>
                <Link to="/design">Open Design Studio</Link>
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-border/30 bg-card/30 backdrop-blur-sm">
        <div className="container py-10">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                className="text-center"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
              >
                <div className="font-display text-4xl font-extrabold gradient-text">{s.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24">
        <div className="container">
          <motion.div className="mb-16 text-center" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <h2 className="font-display text-3xl font-bold md:text-4xl text-foreground">How It Works</h2>
            <p className="mt-3 text-muted-foreground">Four steps from photo to photorealistic design.</p>
          </motion.div>
          <div className="grid gap-6 md:grid-cols-4">
            {workflow.map((step, i) => (
              <motion.div
                key={step.num}
                className="relative glass-card rounded-xl p-6 text-center"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
              >
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <step.icon className="h-6 w-6" />
                </div>
                <span className="font-display text-xs font-bold uppercase tracking-widest text-primary/40">Step {step.num}</span>
                <h3 className="mt-1 font-display text-lg font-semibold text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="border-t border-border/30 py-24">
        <div className="container">
          <motion.div className="mb-16 text-center" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <h2 className="font-display text-3xl font-bold md:text-4xl text-foreground">Built for Designers & Homeowners</h2>
            <p className="mt-3 text-muted-foreground">Real AI models. Real furniture. Real results.</p>
          </motion.div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                className="group glass-card rounded-xl p-6"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-display text-lg font-semibold text-foreground">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Dual CTA */}
      <section className="py-24">
        <div className="container">
          <div className="grid gap-6 md:grid-cols-2">
            <motion.div
              className="glass-card rounded-xl p-8 md:p-10"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={0}
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-display text-2xl font-bold text-foreground">Evaluate a Room</h3>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                Upload any room photo and get a detailed AI report — object detection, material analysis, depth mapping, aesthetic scoring, and style classification.
              </p>
              <Button className="mt-6 btn-premium" asChild>
                <Link to="/evaluate">
                  Evaluate Now <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </motion.div>
            <motion.div
              className="glass-card rounded-xl p-8 md:p-10"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={1}
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Paintbrush className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-display text-2xl font-bold text-foreground">Design Studio</h3>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                3D editor with AI-powered floor plan analysis, furniture placement, photorealistic rendering, and a marketplace with real products at real prices.
              </p>
              <Button className="mt-6 btn-premium" asChild>
                <Link to="/design">
                  Open Studio <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border/30 py-24">
        <div className="container max-w-3xl">
          <motion.div className="mb-12 text-center" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <h2 className="font-display text-3xl font-bold text-foreground">FAQ</h2>
          </motion.div>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border-border/40">
                <AccordionTrigger className="text-left font-display text-foreground hover:text-primary">{faq.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24">
        <div className="container">
          <motion.div
            className="glass-card rounded-2xl p-12 md:p-16 text-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
          >
            <Zap className="mx-auto mb-4 h-8 w-8 text-primary" />
            <h2 className="font-display text-3xl font-bold md:text-4xl text-foreground">Ready to redesign your space?</h2>
            <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
              Upload a photo, get AI analysis, browse real furniture, and see photorealistic renders — all free.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Button size="lg" className="btn-premium px-8" asChild>
                <Link to="/evaluate">Start Evaluating <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <Button size="lg" variant="outline" className="border-border/50 bg-muted/30 backdrop-blur-sm hover:bg-muted/50" asChild>
                <Link to="/about">Learn More</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
