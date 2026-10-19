import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Recycle, Sun, Moon } from "lucide-react";
import { SignOutButton } from "@/components/AuthGate";
import { AddDriverDialog } from "@/components/AddDriverDialog";

function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("wasteops-theme");
    if (saved === "light" || saved === "dark") setTheme(saved);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("wasteops-theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="grid h-9 w-9 place-items-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

export function AppHeader() {
  const cls = "rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground";
  return (
    <header className="sticky top-0 z-[1100] border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Recycle className="h-4 w-4" />
          </span>
          WasteOps
        </Link>
        <nav className="flex gap-1">
          <Link to="/" className={cls} activeProps={{ className: "bg-secondary !text-foreground" }} activeOptions={{ exact: true }}>
            Live Map
          </Link>
          <Link to="/reports" className={cls} activeProps={{ className: "bg-secondary !text-foreground" }}>
            Reports
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <AddDriverDialog />
          <ThemeToggle />
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
