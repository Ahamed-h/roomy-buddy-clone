import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, Box, LogOut, LayoutDashboard, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const links = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/evaluate", label: "Evaluate" },
  { to: "/design", label: "Design Studio" },
];

export function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { user, loading, signInWithGoogle, signOut } = useAuth();

  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const avatarUrl = user?.user_metadata?.avatar_url;
  const initials = displayName.slice(0, 2).toUpperCase();

  const allLinks = user ? [{ to: "/dashboard", label: "Dashboard" }, ...links] : links;

  return (
    <header className="sticky top-0 z-50 w-full glass-nav">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-display text-xl font-bold">
          <Box className="h-6 w-6 text-primary" />
          <span className="text-foreground">aivo<span className="text-primary">.ai</span></span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {allLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={cn(
                "relative rounded-lg px-4 py-2 text-sm font-medium transition-all duration-300",
                location.pathname === link.to
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {link.label}
              {location.pathname === link.to && (
                <span className="absolute bottom-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-primary" />
              )}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {loading ? null : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2 hover:bg-muted">
                  <Avatar className="h-7 w-7 ring-2 ring-primary/30">
                    <AvatarImage src={avatarUrl} />
                    <AvatarFallback className="bg-primary/20 text-xs text-primary">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-foreground">Hi, {displayName.split(" ")[0]}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 glass-card-static">
                <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                  <LayoutDashboard className="mr-2 h-4 w-4" /> My Designs
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                  <Settings className="mr-2 h-4 w-4" /> Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate("/auth")} className="text-muted-foreground hover:text-foreground">
                Sign In
              </Button>
              <Button size="sm" className="btn-premium text-sm" onClick={() => navigate("/auth")}>Get Started</Button>
            </>
          )}
        </div>

        {/* Mobile */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon" className="text-foreground">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72 glass-card-static border-l-border">
            <nav className="mt-8 flex flex-col gap-2">
              {allLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                    location.pathname === link.to
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {link.label}
                </Link>
              ))}
              <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
                {user ? (
                  <>
                    <div className="flex items-center gap-2 px-4 py-2">
                      <Avatar className="h-8 w-8 ring-2 ring-primary/30">
                        <AvatarImage src={avatarUrl} />
                        <AvatarFallback className="bg-primary/20 text-xs text-primary">{initials}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium text-foreground">{displayName}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { setOpen(false); navigate("/dashboard"); }}>
                      My Designs
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setOpen(false); signOut(); }}>
                      Sign Out
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" size="sm" onClick={signInWithGoogle}>Sign In with Google</Button>
                    <Button size="sm" className="btn-premium" onClick={signInWithGoogle}>Get Started</Button>
                  </>
                )}
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
