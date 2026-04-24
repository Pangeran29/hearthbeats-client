import styles from "./page.module.css";

const featureItems = [
  {
    title: "Live tracking",
    description: "Pantau realtime kendaraan Anda kapan saja dan di mana saja.",
  },
  {
    title: "Anti theft warning",
    description: "Dapatkan notifikasi ketika motor on/off agar Anda selalu waspada.",
  },
  {
    title: "History perjalanan",
    description:
      "Dapatkan historical data perjalanan seperti jarak ditempuh, kecepatan, riding time, hingga visualisasi dalam bentuk map.",
  },
  {
    title: "Fuel analysis",
    description:
      "Monitor konsumsi fuel, smart alert system untuk menghindari pencurian BBM.",
  },
  {
    title: "Dan banyak fitur mendatang lain",
    description:
      "Fitur baru akan terus kami hadirkan untuk kebutuhan monitoring Anda.",
  },
];

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

      <section className={`${styles.hero} ${styles.slide}`}>
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
              <strong>Live tracking</strong>
              <span>Pantau realtime kendaraan Anda.</span>
            </li>
            <li>
              <strong>Anti theft warning</strong>
              <span>Dapatkan notifikasi ketika motor on/off.</span>
            </li>
            <li>
              <strong>History perjalanan</strong>
              <span>Analisa jarak, kecepatan, riding time, dan visualisasi map.</span>
            </li>
          </ul>
          
        </div>
        
      </section>

      <section id="fitur" className={`${styles.featuresSection} ${styles.slide}`}>
        <div className={styles.featuresContent}>
          <p className={styles.sectionLabel}>Fitur Lengkap</p>
          <h2 className={styles.featuresHeading}>Satu Dashboard, Banyak Kemampuan</h2>
          <p className={styles.featuresLead}>
            Semua fitur utama tersedia untuk bantu keamanan, kontrol, dan efisiensi
            kendaraan Anda dari satu aplikasi.
          </p>

          <div className={styles.featuresGrid}>
            {featureItems.map((feature) => (
              <article key={feature.title} className={styles.featureCard}>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
