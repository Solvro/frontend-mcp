"use client";

import type { MouseEvent } from "react";
import { MoonIcon, SunIcon } from "./Icons";
import styles from "./ThemeToggle.module.css";

function currentTheme(): "light" | "dark" {
  const attr = document.documentElement.dataset.theme;
  if (attr === "dark" || attr === "light") return attr;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(next: "light" | "dark") {
  const root = document.documentElement;
  root.dataset.theme = next;
  // Odpala animację lampki w scenie: mruganie przy zapalaniu, gaśnięcie przy wyłączaniu.
  root.dataset.lamp = next === "dark" ? "on" : "off";
  try {
    localStorage.setItem("gw-theme", next);
  } catch {
    // tryb prywatny — motyw po prostu nie zostanie zapamiętany
  }
}

const REVEAL_MS = 700;

export function ThemeToggle({ className }: { className?: string }) {
  const toggle = (event: MouseEvent<HTMLButtonElement>) => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!document.startViewTransition || reduceMotion) {
      applyTheme(next);
      return;
    }

    /* Nowy motyw rozlewa się kołem od przełącznika. Stary zostaje pod spodem jako zrzut,
       nowy jest „na żywo”, więc w trakcie widać już np. zapalającą się lampkę. */
    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

    const root = document.documentElement;
    root.dataset.themeSwitching = "";
    const transition = document.startViewTransition(() => applyTheme(next));

    transition.ready
      .then(() => {
        root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          {
            duration: REVEAL_MS,
            easing: "cubic-bezier(0.65, 0, 0.35, 1)",
            pseudoElement: "::view-transition-new(root)",
          },
        );
      })
      .catch(() => undefined);

    transition.finished.finally(() => delete root.dataset.themeSwitching).catch(() => undefined);
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
