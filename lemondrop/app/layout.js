import "./globals.css";
import { Silkscreen } from "next/font/google";

const silkscreen = Silkscreen({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata = {
  title: "LemonDrop - Free Disposable Email",
  description: "Free temporary email. No signup. No card.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={silkscreen.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}