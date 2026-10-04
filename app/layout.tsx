import type { Metadata } from "next";
import { Cinzel, Faustina, Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const faustina = Faustina({
  variable: "--font-faustina",
  subsets: ["latin"],
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
});

// Williwaw by Stephen T. French, SIL OFL (see app/fonts/Williwaw-OFL.txt)
const williwaw = localFont({
  src: "./fonts/Williwaw-Book.woff2",
  variable: "--font-williwaw",
});

export const metadata: Metadata = {
  title: "3D Labs",
  description: "Three.js learning laboratory with React Three Fiber",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${faustina.variable} ${cinzel.variable} ${williwaw.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-slate-950 text-slate-50">{children}</body>
    </html>
  );
}
