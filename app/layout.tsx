/**
 * Root Layout - Sovelluksen juurikomponentti
 * 
 * Määrittelee sovelluksen perusrakenteen, metatiedot ja fontit.
 * Kaikki sivut renderöidään tämän layoutin sisällä.
 */

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// Geist Sans -fontti normaaleille teksteille
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Geist Mono -fontti koodille ja monospacelle
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Sovelluksen metatiedot (näkyvät selaimen välilehdessä ja hakukoneissa)
export const metadata: Metadata = {
  title: "Oulu2026 TPM - TPM Visualization Tool",
  description: "Oulun liikenteen seuranta- ja valvontajärjestelmä",
  icons: {
    icon: '/favicon.svg',
  },
};

/**
 * RootLayout-komponentti
 * @param children - Sivun sisältö renderöidään tähän
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
