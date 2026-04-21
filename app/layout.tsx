import AxiosLogger from "@/components/AxiosLogger";
import Navbar from "@/components/Navbar";
import { DialogProvider } from "@/context/DialogContext";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Byte2Life 3D Printing",
  description:
    "Plataforma de gerenciamento para produção e vendas da Byte2Life.",
  icons: {
    icon: "/byte2life-logo.png?v=20260420",
    shortcut: "/byte2life-logo.png?v=20260420",
    apple: "/byte2life-logo.png?v=20260420",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <DialogProvider>
          <AxiosLogger />
          <Navbar />
          <main className="container mx-auto p-4">{children}</main>
        </DialogProvider>
      </body>
    </html>
  );
}
