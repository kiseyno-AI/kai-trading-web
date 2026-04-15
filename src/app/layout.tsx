import type { Metadata } from "next";
import localFont from "next/font/local";

import { AppStateProvider } from "@/components/providers/app-state-provider";
import "./globals.css";

const sora = localFont({
  src: "../../public/fonts/Sora-Variable.ttf",
  variable: "--font-sora",
  display: "swap",
  weight: "100 800",
});

export const metadata: Metadata = {
  title: "Kai Trading Web",
  description: "Precision & Clarity trading dashboard prototype for Kai Trading",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sora.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <AppStateProvider>{children}</AppStateProvider>
      </body>
    </html>
  );
}
