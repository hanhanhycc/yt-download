import React from "react";

type Props = { className?: string };

// Brand-recognizable but generic monochrome glyphs. Inline so no extra deps.
export const platformLogos: { name: string; node: React.ReactNode }[] = [
  {
    name: "YouTube",
    node: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31.2 31.2 0 0 0 0 12a31.2 31.2 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31.2 31.2 0 0 0 24 12a31.2 31.2 0 0 0-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z"/>
      </svg>
    ),
  },
  {
    name: "TikTok",
    node: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M19.6 6.6a5.7 5.7 0 0 1-3.4-1.1V15a5.4 5.4 0 1 1-5.4-5.4h.5v2.8H11a2.6 2.6 0 1 0 2.6 2.6V2h2.6a5.7 5.7 0 0 0 3.4 5.2v2.6z"/>
      </svg>
    ),
  },
  {
    name: "Instagram",
    node: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    name: "X / Twitter",
    node: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M18.2 2H21l-6.5 7.4L22 22h-6.8l-5-6.6L4.5 22H1.7l7-8L1.6 2h6.9l4.5 6 5.2-6zm-1.2 18.3h1.8L7.1 3.6H5.2l11.8 16.7z"/>
      </svg>
    ),
  },
  {
    name: "Facebook",
    node: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.5 2.9h-2.3v7A10 10 0 0 0 22 12z"/>
      </svg>
    ),
  },
  {
    name: "SoundCloud",
    node: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M2 15a1 1 0 1 1 2 0v3a1 1 0 1 1-2 0v-3zm3-3a1 1 0 1 1 2 0v6a1 1 0 1 1-2 0v-6zm3-1.5a1 1 0 1 1 2 0V18a1 1 0 1 1-2 0v-7.5zm3-1a1 1 0 1 1 2 0V18a1 1 0 1 1-2 0V9.5zm3 .5c0-3 2.3-5.5 5.2-5.5 2.5 0 4.6 1.7 5.2 4 .3-.1.6-.1.9-.1 1.4 0 2.5 1.1 2.5 2.5S22.7 19 21.3 19H14a1 1 0 0 1-1-1V10z"/>
      </svg>
    ),
  },
  {
    name: "Vimeo",
    node: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M23 7.4c-.1 2.3-1.7 5.4-4.8 9.3-3.2 4.1-5.9 6.1-8.1 6.1-1.4 0-2.5-1.3-3.5-3.8L4.7 12c-.7-2.6-1.5-3.8-2.3-3.8-.2 0-.7.3-1.7 1L0 8c1-.9 2.1-1.9 3.1-2.8 1.4-1.2 2.5-1.9 3.2-1.9 1.7-.2 2.7 1 3.1 3.6.5 2.8.8 4.5 1 5.2.6 2.5 1.2 3.8 1.9 3.8.6 0 1.4-.9 2.5-2.7 1.1-1.8 1.7-3.2 1.8-4.2.1-1.2-.3-1.8-1.4-1.8-.5 0-1.1.1-1.7.3.9-2.9 2.7-4.4 5.4-4.3 2 .1 2.9 1.4 2.8 4z"/>
      </svg>
    ),
  },
  {
    name: "Twitch",
    node: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M4 2h17v11l-5 5h-4l-3 3H6v-3H2V5l2-3zm15 10V4H6v12h3v3l3-3h3l4-4zM11 7h2v5h-2V7zm5 0h2v5h-2V7z"/>
      </svg>
    ),
  },
  {
    name: "Bilibili",
    node: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M7 1.5L9 4h6l2-2.5h2L17 4h1a4 4 0 0 1 4 4v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4h1L5 1.5h2zm-1 5a1.5 1.5 0 0 0-1.5 1.5v9A1.5 1.5 0 0 0 6 18.5h12a1.5 1.5 0 0 0 1.5-1.5V8A1.5 1.5 0 0 0 18 6.5H6zM8 10a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm8 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
      </svg>
    ),
  },
  {
    name: "Reddit",
    node: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M22 12c0-1.3-1-2.3-2.3-2.3-.6 0-1.2.3-1.6.7-1.6-1-3.7-1.7-6-1.8l1-3.4 3 .6c0 .8.6 1.4 1.4 1.4s1.4-.6 1.4-1.4-.7-1.5-1.5-1.5c-.5 0-1 .3-1.3.7l-3.3-.7c-.2 0-.4.1-.4.2L11.2 8c-2.4.1-4.5.7-6.1 1.7-.4-.4-1-.6-1.6-.6C2.2 9.1 1.2 10 1.2 11.4c0 .9.6 1.7 1.4 2.1-.1.2-.1.5-.1.7 0 3.2 3.7 5.8 8.2 5.8s8.2-2.6 8.2-5.8c0-.2 0-.5-.1-.7.8-.4 1.4-1.2 1.4-2.1zM7.7 13.2c0-.8.7-1.5 1.5-1.5s1.5.7 1.5 1.5-.7 1.5-1.5 1.5-1.5-.7-1.5-1.5zm7.5 4c-1 1-2.7 1-3.7 1s-2.6 0-3.7-1c-.2-.2-.2-.4 0-.6.2-.2.4-.2.6 0 .6.7 2 .9 3 .9s2.4-.2 3-.9c.2-.2.4-.2.6 0 .3.2.3.4.2.6zm-.4-2.5c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5z"/>
      </svg>
    ),
  },
  {
    name: "Dailymotion",
    node: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M3 3h18v18H3V3zm15.4 3.6l-3 .6v3.7a3.4 3.4 0 0 0-2.4-1 3.7 3.7 0 0 0-3.7 3.8c0 2.2 1.6 3.7 3.6 3.7 1 0 1.8-.3 2.5-1.1v1h3V6.6zm-4.7 8.2a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6z"/>
      </svg>
    ),
  },
  {
    name: "+1000 more",
    node: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="5"  cy="12" r="1.5" fill="currentColor"/>
        <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
        <circle cx="19" cy="12" r="1.5" fill="currentColor"/>
      </svg>
    ),
  },
];

export function PlatformMarquee({ className = "" }: Props) {
  const items = [...platformLogos, ...platformLogos];
  return (
    <div className={`marquee-mask overflow-hidden ${className}`}>
      <div className="marquee flex gap-8 whitespace-nowrap w-max">
        {items.map((p, i) => (
          <div
            key={i}
            className="flex items-center gap-2 text-white/40 hover:text-white/80 transition px-3 py-1.5"
          >
            <span className="text-white/50">{p.node}</span>
            <span className="text-sm font-medium">{p.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Detect a platform by hostname to color jobs / chips */
export function detectPlatform(url?: string | null): { name: string; node: React.ReactNode } {
  if (!url) return { name: "Link", node: platformLogos[platformLogos.length - 1].node };
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return { name: "Link", node: platformLogos[platformLogos.length - 1].node };
  }
  const map: Array<[RegExp, string]> = [
    [/youtu\.?be/, "YouTube"],
    [/tiktok\.com/, "TikTok"],
    [/instagram\.com/, "Instagram"],
    [/(twitter|x)\.com/, "X / Twitter"],
    [/facebook\.com|fb\.watch/, "Facebook"],
    [/soundcloud\.com/, "SoundCloud"],
    [/vimeo\.com/, "Vimeo"],
    [/twitch\.tv/, "Twitch"],
    [/bilibili\.com/, "Bilibili"],
    [/reddit\.com/, "Reddit"],
    [/dailymotion\.com/, "Dailymotion"],
  ];
  for (const [re, name] of map) {
    if (re.test(host)) {
      const hit = platformLogos.find((p) => p.name === name);
      if (hit) return hit;
    }
  }
  return { name: host, node: platformLogos[platformLogos.length - 1].node };
}
