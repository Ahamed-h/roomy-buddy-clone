import { Link } from "react-router-dom";
import { Box } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border/40 bg-background/50 backdrop-blur-sm">
      <div className="container py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
              <Box className="h-5 w-5 text-primary" />
              <span className="text-foreground">aivo<span className="text-primary">.ai</span></span>
            </Link>
            <p className="text-sm text-muted-foreground">
              AI-powered interior design evaluation, 3D room planning, and furniture shopping.
            </p>
          </div>
          <div>
            <h4 className="mb-3 font-display text-sm font-semibold text-foreground">Product</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/evaluate" className="hover:text-primary transition-colors">Evaluate</Link></li>
              <li><Link to="/design" className="hover:text-primary transition-colors">Design Studio</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 font-display text-sm font-semibold text-foreground">Company</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/about" className="hover:text-primary transition-colors">About</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 font-display text-sm font-semibold text-foreground">Created By</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Ahamed H — 220071601018</li>
              <li>Aashif M — 220071601003</li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t border-border/40 pt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} aivo.ai — All rights reserved.
        </div>
      </div>
    </footer>
  );
}
