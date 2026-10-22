import type { Metadata, Viewport } from "next";
import { Fraunces, Geist } from "next/font/google";
import { THEME_SCRIPT } from "@/ui/themeScript";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist-sans", display: "swap" });
// Headlines, big numbers and Bao's moments only; everything you read or tap stays in Geist.
// The SOFT axis rounds the terminals, which is most of the brand.
const display = Fraunces({ subsets: ["latin"], style: ["normal", "italic"], axes: ["SOFT", "WONK", "opsz"], variable: "--font-fraunces", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Cooky", template: "%s · Cooky" },
  description: "Plan dinners from your fridge, buy exactly what you need, and cook before food goes off. With Bao, a bun in a chef's hat.",
};

// Phones: the page runs under the notch and home bar (the tab bar pads itself with the safe
// area), and the browser chrome takes the page's own colours.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f0e6" },
    { media: "(prefers-color-scheme: dark)", color: "#16141b" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The theme script sets data-theme before the first paint, so <html> differs from the server
    // render on purpose (suppressHydrationWarning). It runs on full loads only; this layout never
    // re-renders on navigation, so that is every time it is needed.
    <html lang="en" data-scroll-behavior="smooth" className={`h-full antialiased ${sans.variable} ${display.variable}`} suppressHydrationWarning>
      <head>
        <script
          type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}
        />
      </head>
      <body className="flex min-h-full flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-full focus:bg-foreground focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-background">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
