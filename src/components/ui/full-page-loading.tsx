import styles from "./full-page-loading.module.css";

type FullPageLoadingScreenProps = {
  overlay?: boolean;
  label?: string;
};

export function FullPageLoadingScreen({
  overlay = false,
  label = "Loading next surface",
}: FullPageLoadingScreenProps) {
  return (
    <div
      className={`${styles.shell} ${overlay ? styles.overlay : ""}`.trim()}
      role="status"
      aria-live="polite"
      aria-label={label}
      aria-busy="true"
    >
      <div className={styles.glowPrimary} aria-hidden="true" />
      <div className={styles.glowSecondary} aria-hidden="true" />

      <div className={styles.loader} aria-hidden="true">
        <span className={styles.ring} />
      </div>
    </div>
  );
}
