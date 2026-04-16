import type { Metadata } from "next";
import localFont from "next/font/local";

import { AppStateProvider } from "@/components/providers/app-state-provider";
import { WebDiagnosticsProvider } from "@/components/providers/web-diagnostics-provider";
import "./globals.css";

const sora = localFont({
  src: "../../public/fonts/Sora-Variable.ttf",
  variable: "--font-sora",
  display: "swap",
  weight: "100 800",
});

export const metadata: Metadata = {
  title: "KAI Trading Dashboard",
  description: "Market dashboard for symbols, watchlists, and trading system health.",
  applicationName: "KAI Trading",
  appleWebApp: {
    title: "KAI Trading",
    capable: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sora.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <AppStateProvider>
          <WebDiagnosticsProvider>{children}</WebDiagnosticsProvider>
        </AppStateProvider>
      </body>
    </html>
  );
}
