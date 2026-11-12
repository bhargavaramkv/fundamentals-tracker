import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Nunito } from "next/font/google";
import { AuthGate } from "@/components/AuthGate";
import { Nav } from "@/components/Nav";
import { ProgressProvider } from "@/components/ProgressProvider";
import { Sidebar } from "@/components/Sidebar";
import { getCurriculum, getWorkspaces } from "@/lib/content";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fundamentals",
  description: "Refresh your software-engineering fundamentals, one short interactive lesson at a time.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Draw under the notch / Dynamic Island and home indicator; safe-area insets keep content clear.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f8fc" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1220" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${nunito.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-dvh flex-col">
        <AuthGate>
          <ProgressProvider>
            <Nav />
            <div className="flex-1 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
              <Sidebar curriculum={getCurriculum()} workspaces={getWorkspaces()} />
              <div className="flex min-w-0 flex-col">
                <main className="mx-auto w-full max-w-3xl flex-1 px-[max(1rem,env(safe-area-inset-left))] py-8 sm:py-12 lg:max-w-[80rem] lg:px-10 xl:px-12">{children}</main>
                <footer className="mx-auto w-full max-w-3xl px-[max(1rem,env(safe-area-inset-left))] pb-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+2rem)] text-xs text-ink-3 sm:pb-8 lg:max-w-[80rem] lg:px-10 xl:px-12">
                  Progress stays in your browser unless you enable sync in Settings.
                </footer>
              </div>
            </div>
          </ProgressProvider>
        </AuthGate>
      </body>
    </html>
  );
}
