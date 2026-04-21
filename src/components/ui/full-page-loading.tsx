import styles from "./full-page-loading.module.css";

type FullPageLoadingScreenProps = {
  overlay?: boolean;
  label?: string;
  detail?: string;
};

export function FullPageLoadingScreen({
  overlay = false,
  label = "Loading next surface",
  detail = "Preparing the next trading surface and syncing the latest market packets.",
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

      <div className={styles.panel}>
        <span className={styles.kicker}>KAI Transition</span>
        <strong className={styles.label}>{label}</strong>
        <p className={styles.detail}>{detail}</p>

        <div className={styles.track} aria-hidden="true">
          <span className={styles.beam} />
        </div>

        <div className={styles.metricRow} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}
