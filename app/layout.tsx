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
  metadataBase: new URL("https://neurofridge.app"),
  title: "Neuro Fridge — Know What’s Inside",
  description: "Scan a barcode and keep your shared fridge inventory in sync.",
  openGraph: {
    title: "Neuro Fridge — Know What’s Inside",
    description: "Scan a barcode and keep your shared fridge inventory in sync.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Neuro Fridge barcode scanner interface" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Neuro Fridge — Know What’s Inside",
    description: "Scan a barcode and keep your shared fridge inventory in sync.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
