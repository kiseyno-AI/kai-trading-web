import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";

import { NavigationLoadingProvider } from "@/components/providers/navigation-loading-provider";
import { AppStateProvider } from "@/components/providers/app-state-provider";
import { WebDiagnosticsProvider } from "@/components/providers/web-diagnostics-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
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
    <html lang="en" className={`${inter.variable} ${manrope.variable} dark h-full antialiased`}>
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
