import "./globals.css";

export const metadata = {
  title: "LemonDrop - Free Disposable Email",
  description: "Free temporary email. No signup. No card.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}