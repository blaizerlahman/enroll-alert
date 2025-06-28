import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import type { Metadata } from "next"
import AuthProviderWrapper from "@/components/AuthProviderWrapper"
import { Toaster } from '@/components/ui/sonner'
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"


const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export const metadata: Metadata = {
  title: "EnrollAlert",
  description: 'Never miss an open seat again.',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <AuthProviderWrapper>{children}</AuthProviderWrapper>
        <Toaster/>
        <Analytics/>
        <SpeedInsights/>
      </body>
    </html>
  )
}

