import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "versus.tools — Side-by-Side Code Comparison",
  description:
    "Create beautiful side-by-side code comparison images for social sharing. Supports TypeScript, Python, Go, Rust, and more.",
  metadataBase: new URL("https://versus.tools"),
  openGraph: {
    title: "versus.tools",
    description:
      "Create beautiful side-by-side code comparison images for social sharing.",
    url: "https://versus.tools",
    siteName: "versus.tools",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "versus.tools",
    description:
      "Create beautiful side-by-side code comparison images for social sharing.",
    creator: "@1st1",
  },
  keywords: [
    "code comparison",
    "side by side",
    "code screenshot",
    "syntax highlighting",
    "developer tools",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
