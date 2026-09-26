"use client";

import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/problem";
import { useAuth } from "@/lib/useAuth";
import { EyeIcon, EyeOffIcon, GraphMark, XIcon } from "../Icons";
import { GlassLayer, RoomInterior } from "../RoomArt";
import sceneStyles from "../Scene.module.css";
import styles from "./AuthOverlay.module.css";

type Mode = "login" | "register" | "forgot";

const COPY: Record<Mode, { heading: string; lead: string; title: string; submit: string }> = {
  login: {
    heading: "Dzień dobry. Proszę się przedstawić.",
    lead: "Po zalogowaniu historia rozmów zostaje na koncie, więc do odpowiedzi wrócisz z każdego urządzenia.",
    title: "Zaloguj się",
    submit: "Zaloguj się",
  },
  register: {
    heading: "Zakładamy nową teczkę.",
    lead: "Wystarczy nazwa użytkownika, e-mail i hasło. Link potwierdzający wyślemy na podany adres.",
    title: "Załóż konto",
    submit: "Załóż konto",
  },
  forgot: {
    heading: "Hasło zostało w innej teczce?",
    lead: "Podaj e-mail z konta. Wyślemy link, pod którym ustawisz nowe hasło.",
    title: "Reset hasła",
    submit: "Wyślij link",
  },
};

/* Otwieranie: przycisk „rozrasta się” w cały ekran. Zamykanie: ta sama droga wstecz. */
const EASE_OPEN = "cubic-bezier(0.76, 0, 0.24, 1)";
const EASE_CLOSE = "cubic-bezier(0.65, 0, 0.35, 1)";
const OPEN_MS = 720;
const CLOSE_MS = 540;
const FULL = "inset(0px 0px 0px 0px round 0px)";

function isVisible(rect: DOMRect) {
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.right > 0 &&
    rect.bottom > 0 &&
    rect.left < window.innerWidth &&
    rect.top < window.innerHeight
  );
}

/** Prostokąt przycisku jako `clip-path`; gdy przycisk zniknął z ekranu — zwijamy do środka. */
function clipAt(trigger: HTMLElement) {
  const rect = trigger.getBoundingClientRect();
  if (!trigger.isConnected || !isVisible(rect)) return "inset(50% 50% 50% 50% round 18px)";
  const radius = Number.parseFloat(getComputedStyle(trigger).borderTopLeftRadius) || 11;
  const right = window.innerWidth - rect.right;
  const bottom = window.innerHeight - rect.bottom;
  return `inset(${rect.top}px ${right}px ${bottom}px ${rect.left}px round ${radius}px)`;
}

/** Kopia przycisku leżąca dokładnie na oryginale — to ona „zamienia się” w stronę. */
function placeGhost(ghost: HTMLElement, trigger: HTMLElement) {
  ghost.replaceChildren();
  const rect = trigger.getBoundingClientRect();
  if (!trigger.isConnected || !isVisible(rect)) return false;
  const copy = trigger.cloneNode(true) as HTMLElement;
  copy.removeAttribute("id");
  copy.removeAttribute("data-auth-anchor");
  copy.tabIndex = -1;
  Object.assign(copy.style, { width: "100%", height: "100%", margin: "0", pointerEvents: "none" });
  Object.assign(ghost.style, {
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  });
  ghost.append(copy);
  return true;
}

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type AuthOverlayProps = {
  /** Przycisk, z którego strona się „rozwija” i do którego wraca. */
  trigger: HTMLElement;
  onClosed: () => void;
};

export function AuthOverlay({ trigger, onClosed }: AuthOverlayProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const closingRef = useRef(false);

  const { login } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /* Przenikanie tylko po zmianie trybu — nie przy pierwszym wejściu. */
  const [switched, setSwitched] = useState(false);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const veil = veilRef.current;
    const ghost = ghostRef.current;
    if (!dialog || !veil || !ghost) return;

    if (!dialog.open) dialog.showModal();
    dialog.dataset.state = "open";
    /* „ready” wyłącza kaskadę wejścia — przełączanie trybów ma już tylko krótkie przenikanie. */
    const settle = () => {
      if (!closingRef.current) dialog.dataset.state = "ready";
      firstFieldRef.current?.focus({ preventScroll: true });
    };

    if (prefersReducedMotion()) {
      settle();
      return;
    }

    const hasGhost = placeGhost(ghost, trigger);
    const animations = [
      dialog.animate({ clipPath: [clipAt(trigger), FULL] }, { duration: OPEN_MS, easing: EASE_OPEN }),
      veil.animate({ opacity: [1, 0] }, { duration: 460, delay: 120, easing: "ease-out", fill: "both" }),
    ];
    if (hasGhost) {
      animations.push(
        ghost.animate(
          { opacity: [1, 0], transform: ["scale(1)", "scale(1.6)"] },
          { duration: 260, easing: "ease-out", fill: "both" },
        ),
      );
    }
    const timer = window.setTimeout(settle, OPEN_MS + 420);

    return () => {
      window.clearTimeout(timer);
      animations.forEach((animation) => animation.cancel());
    };
  }, [trigger]);

  const close = useCallback(async () => {
    const dialog = dialogRef.current;
    const veil = veilRef.current;
    const ghost = ghostRef.current;
    if (!dialog || !veil || !ghost || closingRef.current) return;
    closingRef.current = true;
    dialog.dataset.state = "closing";
    /* Karta logowania w sidebarze znika po zalogowaniu — wtedy wracamy do przycisku w topbarze. */
    const target = trigger.isConnected
      ? trigger
      : (document.querySelector<HTMLElement>("[data-auth-anchor]") ?? trigger);

    if (!prefersReducedMotion()) {
      const hasGhost = placeGhost(ghost, target);
      const shrink = dialog.animate(
        { clipPath: [FULL, clipAt(target)] },
        { duration: CLOSE_MS, delay: 140, easing: EASE_CLOSE, fill: "forwards" },
      );
      veil.animate({ opacity: [0, 1] }, { duration: 320, delay: 180, easing: "ease-in", fill: "both" });
      if (hasGhost) {
        ghost.animate(
          { opacity: [0, 1], transform: ["scale(1.4)", "scale(1)"] },
          { duration: 220, delay: CLOSE_MS - 60, easing: "ease-out", fill: "both" },
        );
      }
      await shrink.finished.catch(() => undefined);
    }

    dialog.close();
    if (target.isConnected) target.focus({ preventScroll: true });
    onClosed();
  }, [trigger, onClosed]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setSwitched(true);
    setError(null);
    setNotice(null);
    setShowPassword(false);
    requestAnimationFrame(() => firstFieldRef.current?.focus({ preventScroll: true }));
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause : new ApiError(0, "unknown_error", "Coś poszło nie tak."));
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      if (mode === "login") {
        await login(email, password);
        setPassword("");
        void close();
      } else if (mode === "register") {
        await api.register(username, email, password);
        setPassword("");
        setMode("login");
        setSwitched(true);
        setNotice("Konto założone. Kliknij link z maila, żeby je potwierdzić, a potem się zaloguj.");
      } else {
        await api.forgotPassword(email);
        setNotice("Jeśli konto istnieje, wysłaliśmy link do zmiany hasła.");
      }
    });
  };

  const resendVerification = () =>
    void run(async () => {
      await api.resendVerification(email);
      setNotice("Wysłaliśmy nowy link potwierdzający.");
    });

  const copy = COPY[mode];
  const rise = (index: number) => ({ "--i": index }) as CSSProperties;

  return (
    <dialog
      ref={dialogRef}
      className={styles.overlay}
      aria-labelledby="gw-auth-heading"
      // Escape zamyka tylko ten ekran — nie może dojść do szuflady historii pod spodem
      onKeyDown={(event) => {
        if (event.key === "Escape") event.stopPropagation();
      }}
      onCancel={(event) => {
        event.preventDefault();
        void close();
      }}
    >
      <div className={styles.frame}>
        <header className={`${styles.header} ${styles.rise}`} style={rise(0)}>
          <span className={styles.brand}>
            <span className={styles.mark}>
              <GraphMark size={18} />
            </span>
            Graf Wiedzy
          </span>
          <button
            type="button"
            className={styles.close}
            onClick={() => void close()}
            aria-label="Wróć do okienka"
          >
            <XIcon size={15} />
            <span className={styles.closeLabel} aria-hidden="true">
              Wróć do okienka
            </span>
          </button>
        </header>

        <div className={styles.body}>
          <section className={styles.intro}>
            <div key={mode} className={switched ? styles.swap : undefined}>
              <h1 id="gw-auth-heading" className={`${styles.heading} ${styles.rise}`} style={rise(1)}>
                {copy.heading}
              </h1>
              <p className={`${styles.lead} ${styles.rise}`} style={rise(2)}>
                {copy.lead}
              </p>
            </div>
            <p className={`${styles.aside} ${styles.rise}`} style={rise(3)}>
              Bez konta też możesz zadawać pytania, ale rozmowy nie trafią do historii.
            </p>
          </section>

          <section className={styles.stage}>
            <div className={styles.glow} aria-hidden="true" />

            <div className={styles.scene}>
              <div className={`${styles.window} ${styles.rise}`} style={rise(2)} aria-hidden="true">
                <div className={sceneStyles.plaque}>DZIEKANAT · LOGOWANIE</div>
                <div className={`${sceneStyles.window} ${styles.pane}`}>
                  <div className={sceneStyles.reveal}>
                    <div className={sceneStyles.room}>
                      <RoomInterior />
                      <GlassLayer />
                    </div>
                  </div>
                </div>
                <div className={sceneStyles.sill} />
                <div className={sceneStyles.sillFace} />
              </div>

              <div className={`${styles.card} ${styles.rise}`} style={rise(4)}>
                <div key={mode} className={switched ? styles.swap : undefined}>
                  <h2 className={styles.title}>{copy.title}</h2>

                  <form className={styles.form} onSubmit={handleSubmit}>
                    {notice && (
                      <p className={styles.notice} role="status">
                        {notice}
                      </p>
                    )}
                    {error && (
                      <p className={styles.error} role="alert">
                        {error.message}{" "}
                        {error.code === "email_unverified" && (
                          <button type="button" className={styles.link} onClick={resendVerification}>
                            Wyślij link ponownie
                          </button>
                        )}
                      </p>
                    )}

                    {mode === "register" && (
                      <div className={styles.field}>
                        <label htmlFor="gw-auth-username">Nazwa użytkownika</label>
                        <input
                          ref={firstFieldRef}
                          id="gw-auth-username"
                          className={styles.input}
                          value={username}
                          onChange={(event) => setUsername(event.target.value)}
                          minLength={3}
                          maxLength={255}
                          autoComplete="username"
                          required
                        />
                      </div>
                    )}

                    <div className={styles.field}>
                      <label htmlFor="gw-auth-email">E-mail</label>
                      <input
                        ref={mode === "register" ? undefined : firstFieldRef}
                        id="gw-auth-email"
                        className={styles.input}
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        autoComplete="email"
                        inputMode="email"
                        required
                      />
                    </div>

                    {mode !== "forgot" && (
                      <div className={styles.field}>
                        <div className={styles.labelRow}>
                          <label htmlFor="gw-auth-password">Hasło</label>
                          {mode === "login" && (
                            <button type="button" className={styles.link} onClick={() => switchMode("forgot")}>
                              Nie pamiętam hasła
                            </button>
                          )}
                        </div>
                        <div className={styles.passwordWrap}>
                          <input
                            id="gw-auth-password"
                            className={styles.input}
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            minLength={mode === "register" ? 6 : undefined}
                            autoComplete={mode === "register" ? "new-password" : "current-password"}
                            aria-describedby={mode === "register" ? "gw-auth-password-hint" : undefined}
                            required
                          />
                          <button
                            type="button"
                            className={styles.peek}
                            onClick={() => setShowPassword((value) => !value)}
                            aria-label={showPassword ? "Ukryj hasło" : "Pokaż hasło"}
                            aria-pressed={showPassword}
                          >
                            {showPassword ? <EyeOffIcon size={17} /> : <EyeIcon size={17} />}
                          </button>
                        </div>
                        {mode === "register" && (
                          <p id="gw-auth-password-hint" className={styles.hint}>
                            Co najmniej 6 znaków.
                          </p>
                        )}
                      </div>
                    )}

                    <button type="submit" className={styles.submit} disabled={busy} aria-busy={busy}>
                      {busy ? "Chwileczkę…" : copy.submit}
                    </button>
                  </form>

                  <p className={styles.switch}>
                    {mode === "login" && (
                      <>
                        Nie masz konta?{" "}
                        <button type="button" className={styles.link} onClick={() => switchMode("register")}>
                          Załóż konto
                        </button>
                      </>
                    )}
                    {mode === "register" && (
                      <>
                        Masz już konto?{" "}
                        <button type="button" className={styles.link} onClick={() => switchMode("login")}>
                          Zaloguj się
                        </button>
                      </>
                    )}
                    {mode === "forgot" && (
                      <button type="button" className={styles.link} onClick={() => switchMode("login")}>
                        Wróć do logowania
                      </button>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div ref={veilRef} className={styles.veil} aria-hidden="true" />
      <div ref={ghostRef} className={styles.ghost} aria-hidden="true" />
    </dialog>
  );
}
