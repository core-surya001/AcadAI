import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta",
});

export const metadata: Metadata = {
  title: "AcadAI — AI-Powered Student Performance Platform",
  description:
    "Streamline administrative tasks and gain AI-driven insights into student performance with AcadAI, the modern SaaS platform built for educational institutions.",
  keywords: ["student performance", "AI education", "academic analytics", "SaaS admin"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body className={`${plusJakarta.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
