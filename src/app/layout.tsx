import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";

const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Heartbeats GPS Tracker | Motor Terpantau, Pikiran Lebih Tenang",
  description:
    "Pantau lokasi motor, dapatkan notifikasi mesin, simpan riwayat perjalanan, dan pahami penggunaan motor bersama Heartbeats.",
  icons: {
    icon: "/46d3030f-e152-4906-9474-13123536acbf.jpg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body
        className={`${barlow.variable} ${barlowCondensed.variable}`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
