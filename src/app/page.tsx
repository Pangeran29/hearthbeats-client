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

      <section className={`${styles.hero} ${styles.slide}`}>
        <div className={styles.content}>
          <div className={styles.intro}>
            <p className={styles.kicker}>Heartbeats GPS Tracker</p>
            <h1>Motor Aman, Kamu Tenang.</h1>
            <p className={styles.lead}>
              Layanan monitoring kendaraan online dengan GPS tracker, aplikasi
              Heartbeats, dan notifikasi otomatis untuk membantu menjaga motor tetap
              terpantau.
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
              <span>Pantau posisi motor secara langsung.</span>
            </li>
            <li>
              <strong>Anti theft warning</strong>
              <span>Dapatkan notifikasi saat mesin motor ON/OFF.</span>
            </li>
            <li>
              <strong>Riwayat perjalanan</strong>
              <span>Analisa jarak, kecepatan, waktu berkendara, dan rute.</span>
            </li>
          </ul>
        </div>
      </section>

      <section id="fitur" className={`${styles.featuresSection} ${styles.slide}`}>
        <div className={styles.featuresContent}>
          <div className={styles.pricingHeader}>
            <p className={styles.sectionLabel}>Fitur Lengkap</p>
            <div className={styles.pricingStack}>
              <article className={styles.pricingPlan}>
                <div className={styles.planIntro}>
                  <span>Paket bulanan</span>
                  <h2>Heartbeats Basic</h2>
                  <p>Monitoring motor berjalan tenang setiap hari.</p>
                </div>
                <div className={styles.planDetails}>
                  <strong>Rp 35.000</strong>
                  <span>/bulan</span>
                  <p>Termasuk aplikasi, server, dan koneksi data perangkat.</p>
                </div>
              </article>

              <article className={`${styles.pricingPlan} ${styles.ojolPlan}`}>
                <div className={styles.planIntro}>
                  <span>Penawaran khusus</span>
                  <h2>Khusus Ojol</h2>
                  <p>Diskon khusus untuk driver ojol yang butuh motor selalu terpantau.</p>
                </div>
                <div className={styles.planDetails}>
                  <strong>Ajukan Diskon</strong>
                  <span>verifikasi cepat</span>
                  <a
                    className={styles.planAction}
                    href="https://wa.me/6282171558690"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Chat WhatsApp
                  </a>
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section id="layanan" className={`${styles.termsSection} ${styles.slide}`}>
        <div className={styles.termsContent}>
          <div className={styles.termsDocument}>
            <header className={styles.termsHeader}>
              <div>
                <p className={styles.sectionLabel}>Ketentuan Layanan</p>
                <h2>Syarat Penggunaan Heartbeats</h2>
              </div>
              <p className={styles.effectiveNote}>Berlaku untuk layanan langganan bulanan.</p>
            </header>

            <article className={styles.termsSummary}>
              <p>
                Heartbeats adalah layanan pemantauan kendaraan online. Kami menyediakan
                pelacakan GPS terjangkau dengan fitur canggih melalui langganan bulanan.
                Kami mengelola platform GPS, infrastruktur server, penggunaan data
                internet, dan aplikasi Heartbeats.
              </p>
            </article>

            <div className={styles.termsClauseList}>
              <article className={styles.termClause}>
                <span>01</span>
                <div>
                  <h3>Langganan bulanan meliputi</h3>
                  <ul>
                    <li>Pelacakan sepeda motor secara real-time</li>
                    <li>Notifikasi ON/OFF mesin secara instan</li>
                    <li>
                      Analisis perjalanan, termasuk jarak, kecepatan, waktu berkendara,
                      dan visualisasi peta rute
                    </li>
                    <li>Fitur lainnya akan segera hadir</li>
                  </ul>
                </div>
              </article>

              <article className={styles.termClause}>
                <span>02</span>
                <div>
                  <h3>Kebijakan pembayaran langganan</h3>
                  <p>
                    Langganan Anda harus diperpanjang dalam waktu 7 hari setelah masa
                    akses 30 hari Anda berakhir.
                  </p>
                  <p>
                    Jika pembayaran terlambat, akan dikenakan biaya penalti sebesar
                    Rp 1.000 per hari hingga pembayaran selesai.
                  </p>
                </div>
              </article>

              <article className={styles.termClause}>
                <span>03</span>
                <div>
                  <h3>Kebijakan perangkat GPS</h3>
                  <p>Perangkat GPS disediakan sebagai unit pinjaman.</p>
                  <p>
                    Jika Anda berhenti menggunakan Heartbeats, Anda harus mengembalikan
                    perangkat tersebut.
                  </p>
                  <p>
                    Untuk mengatur pengembalian, silakan hubungi kami melalui
                    <a
                      href="https://web.telegram.org/k/#@jojojows"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {" "}
                      /paysupport
                    </a>.
                  </p>
                </div>
              </article>

              <article className={`${styles.termClause} ${styles.securityClause}`}>
                <span>04</span>
                <div>
                  <h3>Peringatan keamanan perangkat</h3>
                  <p>Heartbeats dapat melacak lokasi perangkat GPS secara real-time.</p>
                  <p>
                    Jangan mencoba mencuri, merusak, atau menyimpan perangkat tanpa izin.
                  </p>
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
