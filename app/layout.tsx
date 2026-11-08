import type { Metadata, Viewport } from "next";
import WebAppChrome from "@/components/WebAppChrome";
import "./globals.css";

export const metadata: Metadata = {
  title: "NH Club Trail Running Alicante",
  description: "Entrenamiento, comunidad y trail running",
  appleWebApp: { capable: true, title: "NH Club Trail Running Alicante", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = { themeColor: "#101113", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body><WebAppChrome>{children}</WebAppChrome></body>
    </html>
  );
}
