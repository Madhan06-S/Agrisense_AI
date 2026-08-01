import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AgriSense AI — Satellite-Powered Parametric Insurance",
  description: "Pillar 5 De-Risking: Instant micro-payouts for 500M+ smallholder farmers using Sentinel-2 NDVI, SAR flood mapping, and XGBoost AI.",
  keywords: ["agrisense", "parametric insurance", "satellite", "NDVI", "farmer", "micro-payout"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
