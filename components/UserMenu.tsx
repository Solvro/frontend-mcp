"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronUpDownIcon, LogoutIcon, SettingsIcon } from "./Icons";
import styles from "./UserMenu.module.css";

type UserMenuProps = {
  email: string;
  /** Nazwa z konta (`/auth/me`); gdy jej brak, zostaje część adresu przed `@`. */
  name: string | null;
  onLogout: () => void;
};

function displayName(email: string) {
  return email.split("@")[0] || email;
}

export function UserMenu({ email, name: accountName, onLogout }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const name = accountName?.trim() || displayName(email);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className={styles.root} ref={rootRef}>
      {open && (
        <div className={styles.menu} id={menuId} role="menu" aria-label="Konto">
          <button type="button" className={styles.menuItem} role="menuitem" disabled>
            <SettingsIcon size={15} />
            Ustawienia
            <span className={styles.soon}>wkrótce</span>
          </button>
          <div className={styles.divider} role="separator" />
          <button
            type="button"
            className={`${styles.menuItem} ${styles.danger}`}
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            <LogoutIcon size={15} />
            Wyloguj
          </button>
        </div>
      )}

      {/* Po zalogowaniu ekran logowania zwija się właśnie tutaj (przycisk w topbarze znika). */}
      <button
        type="button"
        ref={triggerRef}
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""}`}
        data-auth-anchor
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={styles.avatar} aria-hidden="true">
          {name.charAt(0).toUpperCase()}
        </span>
        <span className={styles.who}>
          <span className={styles.name}>{name}</span>
          <span className={styles.email}>{email}</span>
        </span>
        <span className={styles.chevron}>
          <ChevronUpDownIcon size={15} />
        </span>
      </button>
    </div>
  );
}
