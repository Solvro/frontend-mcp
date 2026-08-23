"use client";

import { MoonIcon, SunIcon } from "./Icons";
import styles from "./ThemeToggle.module.css";

function currentTheme(): "light" | "dark" {
  const attr = document.documentElement.dataset.theme;
  if (attr === "dark" || attr === "light") return attr;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle({ className }: { className?: string }) {
  const toggle = () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("gw-theme", next);
    } catch {
      // tryb prywatny — motyw po prostu nie zostanie zapamiętany
    }
  };

  return (
    <button type="button" className={className} onClick={toggle} aria-label="Przełącz motyw">
      <span className={styles.moon}>
        <MoonIcon />
      </span>
      <span className={styles.sun}>
        <SunIcon />
      </span>
    </button>
  );
}
