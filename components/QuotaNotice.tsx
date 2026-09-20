"use client";

import { formatRemaining, useCountdown } from "@/lib/quotaLock";
import { ClockIcon } from "./Icons";
import styles from "./QuotaNotice.module.css";

type QuotaNoticeProps = {
  /** Do kiedy okienko jest zamknięte (epoch ms). */
  lockedUntil: number;
  /** Tylko dla niezalogowanych — po zalogowaniu limit jest wyższy. */
  onLogin?: (trigger: HTMLElement) => void;
};

/** Czerwony komunikat pod polem pytania: limit wyczerpany i ile zostało do resetu. */
export function QuotaNotice({ lockedUntil, onLogin }: QuotaNoticeProps) {
  const remaining = useCountdown(lockedUntil) ?? 0;

  return (
    <div className={styles.notice} role="alert">
      <span className={styles.icon}>
        <ClockIcon size={15} />
      </span>
      <p className={styles.text}>
        <strong>Osiągnięto limit pytań.</strong> Reset za{" "}
        <span className={styles.time}>{formatRemaining(remaining)}</span>.
      </p>
      {onLogin && (
        <button type="button" className={styles.login} onClick={(event) => onLogin(event.currentTarget)}>
          Zaloguj się
        </button>
      )}
    </div>
  );
}
