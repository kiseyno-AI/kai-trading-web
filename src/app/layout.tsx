import type { Metadata } from "next";
import localFont from "next/font/local";

import { NavigationLoadingProvider } from "@/components/providers/navigation-loading-provider";
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
  other: {
    "apple-mobile-web-app-capable": "yes",
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
        <NavigationLoadingProvider>
          <AppStateProvider>
            <WebDiagnosticsProvider>{children}</WebDiagnosticsProvider>
          </AppStateProvider>
        </NavigationLoadingProvider>
      </body>
    </html>
  );
}
