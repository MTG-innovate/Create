import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Fredoka } from "next/font/google";
import "./globals.css";

const fredoka = Fredoka({ variable: "--font-fredoka", weight: ["500", "600"], subsets: ["latin"] });
const atkinson = Atkinson_Hyperlegible({ variable: "--font-atkinson", weight: ["400", "700"], subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Little Steps",
  description: "One warm place for your little one's care, shared with everyone who helps.",
  appleWebApp: { title: "Little Steps", statusBarStyle: "default" },
  icons: { apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFF8F1" },
    { media: "(prefers-color-scheme: dark)", color: "#1D1612" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fredoka.variable} ${atkinson.variable}`}>
      <body>{children}</body>
    </html>
  );
}
