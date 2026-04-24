import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.page}>
      <video
        className={styles.backgroundVideo}
        autoPlay
        muted
        loop
        playsInline
        poster="/1.mp4"
        aria-hidden="true"
      >
        <source src="/1.mp4" type="video/mp4" />
      </video>

      <div className={styles.overlay} aria-hidden="true" />

      <section className={styles.hero}>
        <div className={styles.content}>
          <div className={styles.intro}>
            <p className={styles.kicker}>Heartbeats GPS Tracker</p>
            <h1>Motor Aman, Kamu Tenang.</h1>
            <p className={styles.lead}>
              Harga normal <span className={styles.normalPrice}>Rp 75.000/bulan</span>,
              sekarang <span className={styles.discountPrice}>promo Rp 50.000/bulan</span>.
              Pantau motor real-time, lihat riwayat perjalanan, dan dapat notifikasi otomatis kapan saja.
            </p>

            <div className={styles.actions}>
              <a
                className={styles.primaryAction}
                href="https://wa.me/6281234567890"
                target="_blank"
                rel="noreferrer"
              >
                Chat WhatsApp
              </a>
            </div>
          </div>

          <ul className={styles.pointsList}>
            <li>
              <strong>Real-time tracking</strong>
              <span>Lihat posisi motor langsung di peta.</span>
            </li>
            <li>
              <strong>Riwayat perjalanan</strong>
              <span>Telusuri rute dan aktivitas sebelumnya.</span>
            </li>
            <li>
              <strong>Notifikasi keamanan</strong>
              <span>Terima peringatan otomatis saat ada anomali.</span>
            </li>
          </ul>
        </div>
      </section>
    </main>
  );
}
