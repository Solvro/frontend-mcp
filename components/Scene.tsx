import type { ReactNode } from "react";
import { GlassLayer, RoomInterior } from "./RoomArt";
import styles from "./Scene.module.css";

type SceneProps = {
  /** Pierwszy plan — opiera się na parapecie okienka. */
  children: ReactNode;
  /** Wszystko poniżej pierwszego planu (podpowiedzi, stopka). */
  below?: ReactNode;
  /** Trwająca rozmowa — zastępuje powitanie nad okienkiem. */
  conversation?: ReactNode;
};

export function Scene({ children, below, conversation }: SceneProps) {
  return (
    <div className={styles.stage}>
      <div className={styles.glow} aria-hidden="true" />

      {conversation ?? (
        <>
          <p className={styles.eyebrow}>Asystent studenta · Politechnika Wrocławska</p>
          <h1 className={styles.heading}>Dzień dobry. Czym mogę służyć?</h1>
          <p className={styles.subtitle}>
            Pytaj o regulaminy, terminy, zapisy i stypendia — odpowiem i pokażę, z którego dokumentu
            to wynika.
          </p>
        </>
      )}

      <div className={styles.sceneWrap}>
        <div className={styles.plaque}>DZIEKANAT · OKIENKO 1</div>

        <div className={styles.window}>
          <div className={styles.reveal}>
            <div className={styles.room}>
              <RoomInterior />
              <GlassLayer />
            </div>
          </div>
        </div>

        <div className={styles.sill} />
        <div className={styles.sillFace} />

        <div className={styles.overlap}>{children}</div>
      </div>

      {below}
    </div>
  );
}
