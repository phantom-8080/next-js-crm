"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/ThemeProvider";

type ThemeToggleProps = {
  className?: string;
};

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={className}
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to day mode" : "Switch to night mode"}
      title={isDark ? "Day mode" : "Night mode"}
    >
      {isDark ?
        <Sun className="size-5" />
      : <Moon className="size-5" />}
    </Button>
  );
}
