import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "dark" | "light" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "dark" | "light";
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = "polymarket-theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem(STORAGE_KEY) as Theme) || "dark";
    }
    return "dark";
  });

  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const root = window.document.documentElement;

    const updateTheme = (newTheme: Theme) => {
      let resolved: "dark" | "light";

      if (newTheme === "system") {
        resolved = window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      } else {
        resolved = newTheme;
      }

      setResolvedTheme(resolved);

      root.classList.remove("light", "dark");
      root.classList.add(resolved);

      // Update CSS variables for theme
      if (resolved === "light") {
        root.style.setProperty("--background", "0 0% 100%");
        root.style.setProperty("--foreground", "222 47% 4%");
        root.style.setProperty("--card", "0 0% 98%");
        root.style.setProperty("--card-foreground", "222 47% 4%");
        root.style.setProperty("--popover", "0 0% 100%");
        root.style.setProperty("--popover-foreground", "222 47% 4%");
        root.style.setProperty("--muted", "210 40% 96%");
        root.style.setProperty("--muted-foreground", "215 16% 47%");
        root.style.setProperty("--border", "214 32% 91%");
        root.style.setProperty("--input", "214 32% 91%");
      } else {
        root.style.setProperty("--background", "222 47% 4%");
        root.style.setProperty("--foreground", "210 40% 98%");
        root.style.setProperty("--card", "222 47% 7%");
        root.style.setProperty("--card-foreground", "210 40% 98%");
        root.style.setProperty("--popover", "222 47% 7%");
        root.style.setProperty("--popover-foreground", "210 40% 98%");
        root.style.setProperty("--muted", "217 33% 17%");
        root.style.setProperty("--muted-foreground", "215 20% 65%");
        root.style.setProperty("--border", "217 33% 17%");
        root.style.setProperty("--input", "217 33% 17%");
      }
    };

    updateTheme(theme);

    // Listen for system theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (theme === "system") {
        updateTheme("system");
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    localStorage.setItem(STORAGE_KEY, newTheme);
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}