import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "NH Trail Club",
  description: "Entrenamiento, comunidad y trail running",
};

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
