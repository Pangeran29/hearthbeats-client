import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GPS History Viewer",
  description: "Next.js prototype for historical GPS route viewing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
