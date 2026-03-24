'use client'

import { useTheme } from "@/lib/theme-context";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon, Monitor } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const cycleTheme = () => {
    const themes: Array<"dark" | "light" | "system"> = ["dark", "light", "system"];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  const icons = {
    dark: Moon,
    light: Sun,
    system: Monitor,
  };

  const Icon = icons[theme];

  return (
    <motion.button
      onClick={cycleTheme}
      className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] transition-colors duration-200 border border-[var(--color-border)]"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      aria-label={`Current theme: ${theme}. Click to change.`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={theme}
          initial={{ y: -20, opacity: 0, rotate: -90 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          exit={{ y: 20, opacity: 0, rotate: 90 }}
          transition={{ duration: 0.2 }}
        >
          <Icon className="w-4 h-4 text-[var(--color-text-secondary)]" />
        </motion.div>
      </AnimatePresence>
      
      {theme === "system" && (
        <motion.div
          className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-blue-500 border border-[var(--color-surface)]"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
        />
      )}
    </motion.button>
  );
}