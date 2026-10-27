import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "NH / Club Trail Running Alicante",
  description: "Entrenamiento, comunidad y trail running",
  appleWebApp: { capable: true, title: "NH Trail Club", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = { themeColor: "#101113", width: "device-width", initialScale: 1 };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
