import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "@soft-spark/ui/tokens.css";
import "./globals.css";
import { SessionBar } from "@/components/SessionBar";
import { PushOptIn } from "@/components/PushOptIn";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });

export const metadata: Metadata = {
  title: "Soft Spark",
  description: "Your bot dates. You show up.",
  icons: {
    icon: [{ url: "/brand/svg/soft-spark-favicon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/brand/png/soft-spark-favicon-180.png" }],
  },
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
        <PushOptIn />
        <main style={{ maxWidth: 560, margin: "0 auto", padding: 20 }}>{children}</main>
      </body>
    </html>
  );
}
