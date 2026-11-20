import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "700", "800"],
  variable: "--font-nunito",
});

export const metadata: Metadata = {
  title: "Aprende y Juega",
  description:
    "Un sitio de aprendizaje para niños. Entra por la puerta del espacio y explora planetas con datos reales de NASA.",
  icons: { icon: "/favicon.svg" },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={nunito.variable}>
        <a className="skip" href="#contenido">
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
