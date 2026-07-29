import styles from "@/components/service-viewer.module.css";

export default function ServiceLoading() {
  return (
    <main className={styles.viewport}>
      <section className={styles.appCanvas}>
        <div className={styles.errorState} role="status">
          <span className={styles.errorIcon} aria-hidden="true" />
          <h1>Menyiapkan rekomendasi servis</h1>
          <p>Menghitung jarak terpantau dan milestone motor Anda...</p>
        </div>
      </section>
    </main>
  );
}
