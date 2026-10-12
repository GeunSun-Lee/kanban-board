import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SyncErrorBridge } from "@/components/sync-error-bridge";
import { ToastProvider } from "@/components/toast";
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
  title: "칸반 보드",
  description: "팀 내 소통을 위한 칸반 보드",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ToastProvider>
          <SyncErrorBridge />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
