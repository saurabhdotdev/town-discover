import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BottomNavigation } from "@/components/common/BottomNavigation";
import { AuthProvider } from "@/components/auth/AuthProvider";

export const metadata: Metadata = {
  title: "Town Discover | Maharashtra City Discovery",
  description:
    "Discover events, cafes, food spots, bars, and trending places across Pune, Mumbai, Kolhapur, and Nashik.",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#080b0f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className="dark h-full antialiased" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => {
  try {
    const saved = localStorage.getItem("town-discover-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = saved || (prefersDark ? "dark" : "light");
    document.documentElement.classList.toggle("dark", theme === "dark");
  } catch {}
})();`,
          }}
        />
      </head>
      <body className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]">
        <AuthProvider>
          <main className="flex-1 pb-20 md:pb-0 md:pt-16">{children}</main>
          <BottomNavigation />
        </AuthProvider>
      </body>
    </html>
  );
}
