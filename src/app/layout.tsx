import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BottomNavigation } from "@/components/common/BottomNavigation";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { AiAssistant } from "@/components/common/AiAssistant";
import { ServiceWorkerRegister } from "@/components/common/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "Sheher | Indian City Discovery",
  description:
    "Discover events, cafes, food spots, bars, and trending places across Pune, Mumbai, Kolhapur, Nashik, Bangalore, Chennai, and Delhi.",
  icons: {
    icon: "/favicon.ico",
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
