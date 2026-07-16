"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/ThemeProvider";
import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  className?: string;
  showLabel?: boolean;
};

export function ThemeToggle({ className, showLabel = false }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  if (showLabel) {
    return (
      <Button
        type="button"
        variant="outline"
        className={cn(
          "h-10 cursor-pointer gap-2 rounded-xl border-zinc-200/90 bg-crm-panel px-4 text-sm font-medium text-crm-text shadow-sm hover:bg-crm-panel-muted dark:border-zinc-700/90",
          className,
        )}
        onClick={toggleTheme}
        aria-label={isDark ? "Switch to day mode" : "Switch to night mode"}
      >
        {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
        Theme
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn("cursor-pointer", className)}
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
