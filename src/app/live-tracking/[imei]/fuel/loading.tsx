import styles from "@/components/fuel-calibration-viewer.module.css";

export default function FuelLoading() {
  return (
    <main className={styles.viewport}>
      <section className={styles.appCanvas}>
        <div className={styles.loadingState} role="status">
          <span className={styles.loadingIcon} aria-hidden="true" />
          <h1>Menyiapkan kalibrasi BBM</h1>
          <p>Memuat checkpoint dan hasil kalibrasi motor Anda...</p>
        </div>
      </section>
    </main>
  );
}
