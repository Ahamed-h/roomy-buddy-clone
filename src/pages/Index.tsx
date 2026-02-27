import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight, Upload, BarChart3, Paintbrush, Box, Camera, Share2,
  ChevronDown, Sparkles, Eye, ShoppingCart
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
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" },
  }),
};

const features = [
  {
    icon: BarChart3,
    title: "AI Evaluation",
    desc: "13 design metrics scored by real ML models — YOLO, CLIP, MiDaS, ViT, and more.",
  },
  {
    icon: Sparkles,
    title: "Aesthetic Scoring",
    desc: "Custom ViT model rates your room's visual appeal with professional-grade analysis.",
  },
  {
    icon: Eye,
    title: "Style Detection",
    desc: "Identifies your room's style from 19 interior categories using trait-based AI.",
  },
  {
    icon: Paintbrush,
    title: "Photorealistic Rendering",
    desc: "See exactly what your room will look like with real lighting and materials.",
  },
  {
    icon: ShoppingCart,
    title: "Real Furniture Shopping",
    desc: "Browse furniture from any retailer. Buy direct at their listed price — zero markup.",
  },
  {
    icon: Share2,
    title: "Export & Share",
    desc: "Download reports, export 3D layouts, capture screenshots, and share your designs.",
  },
];

const steps = [
  { num: "01", title: "Upload your room", desc: "Take a photo of any room you want to evaluate or redesign." },
  { num: "02", title: "AI evaluates & scores", desc: "Your actual ML models analyze lighting, objects, style, depth, and aesthetics." },
  { num: "03", title: "Get redesign + 3D layout", desc: "AI generates a photorealistic redesign and a 3D furniture layout." },
  { num: "04", title: "Edit in Design Studio", desc: "Fine-tune your design, add real furniture, and render photorealistic views." },
];

const faqs = [
  {
    q: "What AI models power the evaluation?",
    a: "We use YOLO v26n for object detection, OWL-ViT for open-vocabulary detection, CLIP for material classification, MiDaS for depth estimation, a custom ViT model for aesthetic scoring, and a TensorFlow model for style trait prediction. Runs locally on your machine.",
  },
  {
    q: "Is the furniture real or placeholder?",
    a: "100% real. Upload a photo of any furniture piece and AI converts it to a to-scale 3D model. Or browse our marketplace that searches real retailers — you buy direct at their price with zero markup.",
  },
  {
    q: "How does photorealistic rendering work?",
    a: "The Render button uses Gemini image generation with your room photo and placed furniture as context. It applies real lighting and materials so you see exactly what your room will look like.",
  },
  {
    q: "Is this free to use?",
    a: "The ML models run locally on your machine — no cloud GPU needed. The frontend is completely free. AI chat features use Gemini via Lovable AI which has generous free tiers.",
  },
  {
    q: "Who created this?",
    a: "aivo.ai was created by Ahamed H (220071601018) and Aashif M (220071601003).",
  },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(152_60%_42%/0.08),transparent_70%)]" />
        <div className="container relative py-24 md:py-32">
          <motion.div
            className="mx-auto max-w-3xl text-center"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={0}
          >
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              AI-Powered Design Studio
            </span>
            <h1 className="mt-4 font-display text-5xl font-bold leading-tight tracking-tight md:text-7xl">
              3D design
              <br />
              <span className="text-primary">&amp; shopping.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
              Evaluate your room with real ML models. Get AI redesigns. Shop real furniture from any store — zero markup. All in one studio.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Button size="lg" asChild>
                <Link to="/evaluate">
                  Evaluate your room <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/design">Open Design Studio</Link>
              </Button>
            </div>
          </motion.div>

          {/* Preview image */}
          <motion.div
            className="mx-auto mt-16 max-w-5xl overflow-hidden rounded-xl border border-border shadow-2xl"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.7 }}
          >
            <img
              src="/images/design-studio-preview.png"
              alt="aivo.ai Design Studio preview showing 3D room layout editor"
              className="w-full"
              loading="lazy"
            />
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t border-border bg-muted/30 py-24">
        <div className="container">
          <motion.div
            className="mb-16 text-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
          >
            <h2 className="font-display text-3xl font-bold md:text-4xl">How It Works</h2>
            <p className="mt-3 text-muted-foreground">Four steps to your perfect room.</p>
          </motion.div>
          <div className="grid gap-8 md:grid-cols-4">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                className="relative rounded-xl border border-border bg-card p-6"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
              >
                <span className="font-display text-4xl font-bold text-primary/20">{step.num}</span>
                <h3 className="mt-2 font-display text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24">
        <div className="container">
          <motion.div
            className="mb-16 text-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
          >
            <h2 className="font-display text-3xl font-bold md:text-4xl">Everything you need</h2>
            <p className="mt-3 text-muted-foreground">Real AI. Real furniture. Real results.</p>
          </motion.div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                className="group rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-lg"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-display text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature highlights from uploaded images */}
      <section className="border-t border-border bg-muted/30 py-24">
        <div className="container">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={0}
            >
              <h2 className="font-display text-3xl font-bold md:text-4xl">
                Photorealistic before you purchase
              </h2>
              <p className="mt-4 text-muted-foreground">
                Generate renders with real lighting and materials. See exactly what your room will look like, not an approximation.
              </p>
              <div className="mt-6 space-y-4">
                <div className="flex gap-3">
                  <Camera className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <h4 className="font-display font-semibold">Every store, zero markup</h4>
                    <p className="text-sm text-muted-foreground">Browse furniture from any retailer on the web. Buy direct at their listed price.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <h4 className="font-display font-semibold">AI that designs with you</h4>
                    <p className="text-sm text-muted-foreground">Tell RoomBot what you want. It sees your space like a professional and gives you layouts, advice, and pieces that work.</p>
                  </div>
                </div>
              </div>
              <Button className="mt-8" asChild>
                <Link to="/design">
                  Try Design Studio <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </motion.div>
            <motion.div
              className="overflow-hidden rounded-xl border border-border shadow-xl"
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <img
                src="/images/design-studio-features.png"
                alt="Design Studio features showing photorealistic rendering and furniture marketplace"
                className="w-full"
                loading="lazy"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24">
        <div className="container max-w-3xl">
          <motion.div
            className="mb-12 text-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
          >
            <h2 className="font-display text-3xl font-bold">Frequently Asked Questions</h2>
          </motion.div>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-left font-display">{faq.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-border bg-muted/30 py-24">
        <div className="container text-center">
          <h2 className="font-display text-3xl font-bold md:text-4xl">Ready to redesign your space?</h2>
          <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
            Upload a photo, get AI analysis, browse real furniture, and see photorealistic renders — all free.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" asChild>
              <Link to="/evaluate">Start Evaluating <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/about">Learn More</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
