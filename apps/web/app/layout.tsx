import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "@soft-spark/ui/tokens.css";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });

export const metadata: Metadata = {
  title: "Soft Spark",
  description: "Your bot dates. You show up.",
  appleWebApp: {
    capable: true,
    title: "Soft Spark",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/brand/svg/soft-spark-favicon.svg", type: "image/svg+xml" },
      { url: "/brand/png/soft-spark-favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/brand/png/soft-spark-favicon-180.png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`ss-page ${inter.variable} ${fraunces.variable}`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
