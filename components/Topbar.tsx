"use client";

import { ClockIcon, LoginIcon, MenuIcon } from "./Icons";
import { ThemeToggle } from "./ThemeToggle";
import styles from "./Topbar.module.css";

type TopbarProps = {
  onLogin: () => void;
  onOpenDrawer: () => void;
};

export function Topbar({ onLogin, onOpenDrawer }: TopbarProps) {
  return (
    <header className={styles.topbar}>
      <button
        type="button"
        className={styles.menuButton}
        onClick={onOpenDrawer}
        aria-label="Pokaż historię rozmów"
      >
        <MenuIcon />
      </button>

      <div className={styles.pill}>
        <span className={styles.pillIcon}>
          <ClockIcon size={15} />
        </span>
        Okienko czynne 24/7
      </div>

      <div className={styles.spacer} />

      <ThemeToggle className={styles.iconButton} />

      <button type="button" className={styles.login} onClick={onLogin}>
        <LoginIcon size={16} />
        <span className={styles.loginLabel}>Zaloguj się</span>
      </button>
    </header>
  );
}
