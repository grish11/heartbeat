import type { Metadata } from "next";
import localFont from "next/font/local";

import { SiteHeader } from "@/components/SiteHeader";
import { Providers } from "./providers";
import "./globals.css";

// Comic Code, self-hosted. Paths are relative to this file.
// https://nextjs.org/docs/app/api-reference/components/font
//
// Despite the filename, ComicCode-Light reports itself as the Regular face
// (fontconfig weight 80), so it is mapped to 400 rather than 300 — otherwise
// the browser would synthesise a lighter weight on top of an already-regular
// font. There is no bold-italic file, so bold italic will be synthesised.
const comicCode = localFont({
  src: [
    { path: "./fonts/ComicCode-Light.otf", weight: "400", style: "normal" },
    { path: "./fonts/ComicCode-Italic.otf", weight: "400", style: "italic" },
    { path: "./fonts/ComicCode-Bold.otf", weight: "700", style: "normal" },
  ],
  variable: "--font-comic-code",
  display: "swap",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
});

export const metadata: Metadata = {
  title: "Heartbeat",
  description: "A dead man's switch on Ethereum, guarded by people you trust.",
};

// A plain server component: all the wallet wiring lives in <Providers>, which
// is client-only because RainbowKit is.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${comicCode.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-neutral-950 text-neutral-100">
        <Providers>
          <SiteHeader />
          <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 pb-16">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
