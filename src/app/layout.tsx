import type { Metadata, Viewport } from "next";
import dynamic from "next/dynamic";
import "./globals.css";
import { BottomNavigation } from "@/components/common/BottomNavigation";
import { AuthProvider } from "@/components/auth/AuthProvider";

// Lazy-load non-critical layout components (code-split into separate chunks)
const AiAssistant = dynamic(
  () => import("@/components/common/AiAssistant").then((mod) => mod.AiAssistant)
);
const ServiceWorkerRegister = dynamic(
  () => import("@/components/common/ServiceWorkerRegister").then((mod) => mod.ServiceWorkerRegister)
);

export const metadata: Metadata = {
  title: "Sheher | Indian City Discovery",
  description:
    "Discover events, cafes, food spots, bars, and trending places across Pune, Mumbai, Kolhapur, Nashik, Bangalore, Chennai, and Delhi.",
  icons: {
    icon: "/favicon.ico",
    apple: "/sheher_logo.png",
  },
  manifest: "/manifest.json",
  metadataBase: new URL("https://sheher-city.vercel.app"),
  openGraph: {
    title: "Sheher | Indian City Discovery",
    description:
      "Discover cafes, food spots, bars, hidden gems and trending places across Indian cities. Real-time crowd signals, community hangouts and trip planning.",
    url: "https://sheher-city.vercel.app",
    siteName: "Sheher",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Sheher — Discover your city's best kept secrets",
      },
    ],
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sheher | Indian City Discovery",
    description:
      "Discover cafes, food spots, bars, hidden gems and trending places across Indian cities.",
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#080b0f",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className="dark h-full antialiased" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Sheher" />
        <link rel="apple-touch-icon" href="/sheher_logo.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => {
  try {
    const saved = localStorage.getItem("sheher-theme") || localStorage.getItem("town-discover-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = saved || (prefersDark ? "dark" : "light");
    document.documentElement.classList.toggle("dark", theme === "dark");
  } catch {}
})();`,
          }}
        />
      </head>
      <body className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <AuthProvider>
          <ServiceWorkerRegister />
          <main className="flex-1 w-full max-w-full overflow-x-hidden pb-24 pt-14 md:pb-0 md:pt-16">{children}</main>
          <BottomNavigation />
          <AiAssistant />
        </AuthProvider>
      </body>
    </html>
  );
}
