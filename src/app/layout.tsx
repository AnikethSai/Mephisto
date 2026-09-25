import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "Mephisto's Bargain — Soul Coin System",
  description: 'Digital Soul Coin Management Platform for Mephisto\'s Bargain',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#080608] text-gray-100 antialiased selection:bg-amber-500 selection:text-black min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
