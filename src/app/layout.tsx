import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Heartbeats GPS Tracker",
  description: "Landing page and GPS history viewer for Heartbeats motor monitoring.",
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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
