import "./globals.css";
import type { Metadata } from "next";
import { NavBar } from "@/components/navbar";

export const metadata: Metadata = {
  title: "Loom · Self-hosted media downloader",
  description: "A modern, self-hosted yt-dlp web app. Download from 1000+ sites.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <NavBar />

        <main className="max-w-6xl mx-auto px-5 py-10 md:py-14">{children}</main>

        <footer className="max-w-6xl mx-auto px-5 py-10 mt-10 border-t border-white/[0.06] text-xs text-white/40 flex flex-col md:flex-row items-center justify-between gap-3">
          <div>
            Built on <span className="text-white/70">yt-dlp</span> ·{" "}
            <span className="text-white/70">FastAPI</span> ·{" "}
            <span className="text-white/70">Next.js</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot" />
            <span>All systems operational</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
