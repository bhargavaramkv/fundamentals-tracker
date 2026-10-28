import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Nav } from "@/components/Nav";
import { ProgressProvider } from "@/components/ProgressProvider";
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
  title: "Fundamentals Tracker",
  description: "Revisit engineering fundamentals, find weak areas, and practice them adaptively.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ProgressProvider>
          <Nav />
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-8">{children}</main>
          <footer className="mx-auto w-full max-w-5xl px-4 pb-8 text-xs text-ink-3">
            Lessons and questions live in <code>/content</code>. Progress stays in your browser unless you enable sync.
          </footer>
        </ProgressProvider>
      </body>
    </html>
  );
}
