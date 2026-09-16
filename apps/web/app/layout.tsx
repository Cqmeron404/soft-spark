import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "@soft-spark/ui/tokens.css";
import "./globals.css";
import { SessionBar } from "@/components/SessionBar";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });

export const metadata: Metadata = {
  title: "Soft spark",
  description: "Your bot dates. You show up for the invite.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`ss-page ${inter.variable} ${fraunces.variable}`}>
        <SessionBar />
        <main style={{ maxWidth: 560, margin: "0 auto", padding: 20 }}>{children}</main>
      </body>
    </html>
  );
}
