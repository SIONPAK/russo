import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import 'react-toastify/dist/ReactToastify.css';
import { ToastContainer } from "react-toastify";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "루소 | 의류 도매 플랫폼",
    template: "%s | 루소"
  },
  description: "루소는 전국 의류 소매업체들을 위한 원스톱 플랫폼입니다. 다양한 의류 상품을 합리적인 가격으로 제공하며, 신속한 배송과 전문적인 서비스로 고객만족을 실현합니다.",
  keywords: ["의류 도매", "도매 플랫폼", "의류 B2B", "패션 도매", "의류 공급업체", "루소", "LUSSO"],
  authors: [{ name: "루소" }],
  creator: "루소",
  publisher: "루소",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://lusso.co.kr'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: '/',
    title: '루소 | 의류 도매 플랫폼',
    description: '루소는 전국 의류 도매업체들을 위한 원스톱 플랫폼입니다. 다양한 의류 상품을 합리적인 가격으로 제공하며, 신속한 배송과 전문적인 서비스로 고객만족을 실현합니다.',
    siteName: '루소',
    images: [
      {
        url: '/images/opengraph_image.jpeg',
        width: 1200,
        height: 630,
        alt: '루소 - 의류 도매 플랫폼',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '루소 | 의류 도매 플랫폼',
    description: '루소는 전국 의류 도매업체들을 위한 원스톱 플랫폼입니다. 다양한 의류 상품을 합리적인 가격으로 제공하며, 신속한 배송과 전문적인 서비스로 고객만족을 실현합니다.',
    images: ['/images/opengraph_image.jpeg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <ToastContainer
          position="top-center"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
        />
      </body>
    </html>
  );
}
