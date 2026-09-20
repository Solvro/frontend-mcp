"use client";

import { formatRemaining, useCountdown } from "@/lib/quotaLock";
import { ClockIcon, LoginIcon, MenuIcon } from "./Icons";
import { ThemeToggle } from "./ThemeToggle";
import styles from "./Topbar.module.css";

type TopbarProps = {
  /** Tylko dla niezalogowanych — wylogowanie jest w panelu konta w sidebarze. */
  showLogin: boolean;
  /** Limit pytań wyczerpany do tej chwili (epoch ms); `null` — okienko czynne. */
  lockedUntil: number | null;
  /** Dostaje przycisk, z którego rozwinie się ekran logowania. */
  onLogin: (trigger: HTMLElement) => void;
  onOpenDrawer: () => void;
};

export function Topbar({ showLogin, lockedUntil, onLogin, onOpenDrawer }: TopbarProps) {
  const remaining = useCountdown(lockedUntil);

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

      <div className={`${styles.pill} ${remaining !== null ? styles.pillClosed : ""}`} role="status">
        <span className={styles.pillIcon}>
          <ClockIcon size={15} />
        </span>
        {remaining !== null ? (
          <span className={styles.pillText}>
            Okienko zamknięte jeszcze przez <strong>{formatRemaining(remaining)}</strong>
          </span>
        ) : (
          "Okienko czynne 24/7"
        )}
      </div>

      <div className={styles.spacer} />

      <ThemeToggle className={styles.iconButton} />

      {/* Po zalogowaniu przycisk znika, a ekran logowania zwija się do panelu konta
          w sidebarze (też ma `data-auth-anchor`). */}
      {showLogin && (
        <button
          type="button"
          className={styles.login}
          data-auth-anchor
          onClick={(event) => onLogin(event.currentTarget)}
        >
          <LoginIcon size={16} />
          <span className={styles.loginLabel}>Zaloguj się</span>
        </button>
      )}
    </header>
  );
}
