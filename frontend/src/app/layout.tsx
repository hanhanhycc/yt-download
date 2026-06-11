import "./globals.css";
import type { Metadata } from "next";
import { NavBar } from "@/components/navbar";
import { APP_NAME, APP_TAGLINE, HeartIcon, REPO_URL } from "@/components/brand";

export const metadata: Metadata = {
  title: `${APP_NAME} · ${APP_TAGLINE}`,
  description: "Download anything from 1000+ sites. Paste a link, pick MP4 or MP3, done.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <NavBar />

        <main className="max-w-6xl mx-auto px-5 py-10 md:py-14">{children}</main>

        <footer className="max-w-6xl mx-auto px-5 py-10 mt-10 border-t border-white/[0.06] text-sm text-white/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-white/40">© {APP_NAME}</span>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 hover:bg-white/5 hover:text-white transition focus-ring"
          >
            <span>Code with</span>
            <HeartIcon className="w-4 h-4 text-red-500" />
            <span aria-hidden>·</span>
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
              <path d="M12 .5C5.4.5 0 5.9 0 12.6c0 5.3 3.4 9.8 8.2 11.4.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 24 12.6C24 5.9 18.6.5 12 .5Z" />
            </svg>
            <span>GitHub</span>
          </a>
        </footer>
      </body>
    </html>
  );
}
