import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cooky",
  description: "Plan meals from your fridge, buy exactly what you need, cook before food goes off.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
