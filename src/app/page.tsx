import Image from "next/image";
import styles from "./page.module.css";

const purchaseUrl = "https://s.shopee.co.id/5LBz2KdFtG";

/**
 * THESIS: Tangible hardware and live app proof make Heartbeats immediately credible.
 * OWN-WORLD: Ivory paper, forest green, and route orange around precise product scenes.
 * STORY: See the tracker, understand its daily value, then purchase.
 * FIRST VIEWPORT: Promise and proof sit beside a phone-and-tracker composition; buying is immediate.
 * FORM: An 821px product story that becomes a clean single-column layout on mobile.
 */

type IconName = "pin" | "bell" | "shield" | "wrench" | "bag" | "arrow" | "pulse";

function Icon({ name }: { name: IconName }) {
  if (name === "bag") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 8.5h13l-1 11h-11l-1-11Z" /><path d="M8.5 9V6.75a3.5 3.5 0 0 1 7 0V9" /></svg>;
  if (name === "arrow") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13" /><path d="m13 6 6 6-6 6" /></svg>;
  if (name === "pulse") return <svg viewBox="0 0 28 28" aria-hidden="true"><path d="M2 14h5l3-7 5 14 3-7h8" /></svg>;
  const paths = {
    pin: <><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z" /><circle cx="12" cy="10" r="2" /></>,
    bell: <><path d="M18 10a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" /><path d="M10 22h4" /></>,
    shield: <><path d="M12 3 20 6v5c0 5.3-3.3 8.5-8 10-4.7-1.5-8-4.7-8-10V6l8-3Z" /><path d="m9 12 2 2 4-4" /></>,
    wrench: <><path d="M14.5 6.2a5 5 0 0 0-6.1 6.4L3 18l3 3 5.5-5.4a5 5 0 0 0 6.4-6.1l-3.2 3.2-2.5-2.5 2.3-4Z" /></>,
  } as const;
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function PurchaseLink({ className, children }: { className?: string; children: React.ReactNode }) {
  return <a className={`${styles.purchase} ${className ?? ""}`} href={purchaseUrl} target="_blank" rel="noreferrer"><Icon name="bag" />{children}<Icon name="arrow" /></a>;
}

function TextLink({ children }: { children: React.ReactNode }) {
  return <a className={styles.textLink} href="#fitur">{children}<Icon name="arrow" /></a>;
}

const benefits: Array<{ icon: "pin" | "bell" | "shield" | "wrench"; text: string }> = [
  { icon: "pin", text: "Pelacakan\nreal-time" }, { icon: "bell", text: "Notifikasi\ninstan" },
  { icon: "shield", text: "Keamanan\nekstra" }, { icon: "wrench", text: "Mudah\ndipasang" },
];
const productFacts: Array<{ icon: "pin" | "shield" | "wrench"; title: string; copy: string }> = [
  { icon: "pin", title: "Ukuran ringkas", copy: "8.5 x 3.2 x 1.4 cm" }, { icon: "shield", title: "Bodi kokoh", copy: "tahan lama" }, { icon: "wrench", title: "Mudah dipasang", copy: "kompatibel untuk berbagai motor" },
];

export default function Home() {
  return <main className={styles.page} id="top"><div className={styles.canvas}>
    <header className={styles.header}>
      <a className={styles.brand} href="#top" aria-label="Heartbeats"><Icon name="pulse" /><span><strong>heartbeats</strong><small>A safer ride, a better tomorrow.</small></span></a>
      <nav className={styles.nav} aria-label="Navigasi utama"><a href="#fitur">Fitur</a><a href="#perangkat">Cara Kerja</a><a href="#harga">Harga</a><a href="#bantuan">Bantuan</a></nav>
      <PurchaseLink className={styles.headerPurchase}>Beli Sekarang</PurchaseLink>
    </header>

    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.heroCopy}><p className={styles.eyebrow}>GPS Tracker untuk Motor <span /> <small>Kecil. Andal. Selalu terhubung.</small></p><h1 id="hero-title"><em>Motor terpantau.</em> Pikiran lebih tenang.</h1><p className={styles.lead}>Pantau lokasi, dapatkan notifikasi penting, dan lihat riwayat perjalanan motor Anda, semua dalam satu perangkat yang ringkas.</p><PurchaseLink>Beli Sekarang</PurchaseLink><ul className={styles.benefits}>{benefits.map(({ icon, text }) => <li key={icon}><span className={styles.benefitIcon}><Icon name={icon} /></span><span>{text}</span></li>)}</ul></div>
      <div className={styles.heroVisual} aria-label="Aplikasi Heartbeats dan perangkat GPS tracker"><div className={styles.heroBlob} /><Image src="/picture_about_heartbeats/hero-phone-tracker.png" alt="Aplikasi Heartbeats dengan rute perjalanan dan GPS tracker" width={1180} height={1333} priority sizes="440px" /></div>
    </section>

    <section className={styles.hardware} id="perangkat" aria-labelledby="hardware-title">
      <div className={styles.hardwareCopy}><p className={styles.sectionLabel}>Perangkat Heartbeats</p><h2 id="hardware-title">Kecil, kuat,<br />siap melindungi.</h2><p>Perangkat GPS Tracker Heartbeats dirancang ringkas, tahan lama, dan mudah dipasang di berbagai jenis motor.</p><TextLink>Lihat detail perangkat</TextLink></div>
      <div className={styles.hardwareVisual}><Image src="/picture_about_heartbeats/landing-hardware-hd.png" alt="Perangkat GPS Tracker Heartbeats" fill sizes="360px" /></div>
      <ul className={styles.facts}>{productFacts.map((fact) => <li key={fact.title}><span><Icon name={fact.icon} /></span><p><strong>{fact.title}</strong><small>{fact.copy}</small></p></li>)}</ul>
    </section>

    <section className={styles.features} id="fitur" aria-label="Fitur Heartbeats">
      <article className={`${styles.feature} ${styles.featureLive}`}><div className={styles.featureMedia}><Image src="/picture_about_heartbeats/landing-live.png" alt="Tampilan lokasi motor secara real-time" fill sizes="506px" /></div><div className={styles.featureCopy}><p className={styles.sectionLabel}>Fitur utama</p><h2>Lacak posisi motor kapan saja,<br />di mana saja.</h2><p>Pantau lokasi motor Anda secara real-time dan lihat ringkasan perjalanan setiap hari langsung dari aplikasi.</p><TextLink>Pelajari lebih lanjut</TextLink></div></article>
      <article className={`${styles.feature} ${styles.featureAlert}`}><div className={styles.featureCopy}><p className={styles.sectionLabel}>Notifikasi cerdas</p><h2>Langsung tahu saat mesin menyala atau dimatikan.</h2><p>Dapatkan notifikasi instan ke ponsel Anda setiap kali mesin motor dinyalakan atau dimatikan. Reaksi lebih cepat, rasa aman lebih besar.</p><TextLink>Lihat semua fitur</TextLink></div><div className={styles.featureMedia}><Image src="/picture_about_heartbeats/landing-alert.png" alt="Notifikasi mesin motor Heartbeats" fill sizes="483px" /></div></article>
      <article className={`${styles.feature} ${styles.featureJourney}`}><div className={styles.featureMedia}><Image src="/picture_about_heartbeats/landing-journey.png" alt="Rute dan ringkasan riwayat perjalanan" fill sizes="486px" /></div><div className={styles.featureCopy}><p className={styles.sectionLabel}>Riwayat perjalanan</p><h2>Setiap perjalanan tercatat dengan lengkap.</h2><p>Lihat rute yang Anda lewati, durasi, jarak, dan bahkan kecepatan. Semua data penting, langsung di ujung jari Anda.</p><TextLink>Lihat contoh</TextLink></div></article>
      <article className={`${styles.feature} ${styles.featureInsight}`}><div className={styles.featureCopy}><p className={styles.sectionLabel}>Lebih dari sekadar pelacakan</p><h2>Pantau servis<br />dan bahan bakar.</h2><p>Atur pengingat servis dan catat pengisian bahan bakar, agar motor Anda selalu dalam kondisi prima.</p><TextLink>Pelajari fitur lainnya</TextLink></div><div className={styles.featureMedia}><Image src="/picture_about_heartbeats/landing-insight.png" alt="Pengingat servis dan catatan bahan bakar" fill sizes="504px" /></div></article>
    </section>

    <section className={styles.conversion} id="harga" aria-label="Beli GPS tracker Heartbeats"><div><p className={styles.sectionLabel}>Harga yang masuk akal</p><h2>Investasi kecil<br />untuk rasa aman yang besar.</h2></div><div className={styles.conversionAction}><p>Dapatkan Heartbeats GPS Tracker sekarang<br />dan rasakan sendiri ketenangan di setiap perjalanan.</p><PurchaseLink>Beli Sekarang</PurchaseLink></div></section>
    <footer className={styles.footer} id="bantuan"><a className={styles.brand} href="#top"><Icon name="pulse" /><span><strong>heartbeats</strong><small>A safer ride, a better tomorrow.</small></span></a><nav aria-label="Navigasi footer"><a href="#fitur">Fitur</a><a href="#perangkat">Cara Kerja</a><a href="#harga">Harga</a><a href="#bantuan">Bantuan</a></nav><div className={styles.footerEnd}><nav className={styles.socialLinks} aria-label="Media sosial"><a href="https://www.instagram.com/on.heartbeats/" target="_blank" rel="noreferrer">Instagram</a><a href="https://www.threads.com/@on.heartbeats" target="_blank" rel="noreferrer">Threads</a></nav><p><Icon name="pulse" />Motor aman.<br /><span>Cerita lebih banyak lagi esok.</span></p></div></footer>
  </div></main>;
}
