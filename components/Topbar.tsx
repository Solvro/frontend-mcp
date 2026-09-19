"use client";

import { formatRemaining, useCountdown } from "@/lib/quotaLock";
import { ClockIcon, LoginIcon, LogoutIcon, MenuIcon } from "./Icons";
import { ThemeToggle } from "./ThemeToggle";
import styles from "./Topbar.module.css";

type TopbarProps = {
  /** Zalogowany użytkownik; `null` — tryb anonimowy. */
  email: string | null;
  /** Limit pytań wyczerpany do tej chwili (epoch ms); `null` — okienko czynne. */
  lockedUntil: number | null;
  /** Dostaje przycisk, z którego rozwinie się ekran logowania. */
  onLogin: (trigger: HTMLElement) => void;
  onLogout: () => void;
  onOpenDrawer: () => void;
};

export function Topbar({ email, lockedUntil, onLogin, onLogout, onOpenDrawer }: TopbarProps) {
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

      {/* Jeden i ten sam <button> w obu stanach — ekran logowania zwija się z powrotem
          do tego elementu, więc React nie może go podmienić po zalogowaniu. */}
      <button
        type="button"
        className={styles.login}
        data-auth-anchor
        onClick={(event) => (email ? onLogout() : onLogin(event.currentTarget))}
        aria-label={email ? `Wyloguj (${email})` : undefined}
        title={email ?? undefined}
      >
        {email ? <LogoutIcon size={16} /> : <LoginIcon size={16} />}
        <span className={styles.loginLabel}>{email ? "Wyloguj" : "Zaloguj się"}</span>
      </button>
    </header>
  );
}
