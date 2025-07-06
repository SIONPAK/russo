import type { Metadata } from "next";
import "./globals.css";

import 'react-toastify/dist/ReactToastify.css';
import { ToastContainer } from "react-toastify";

export const metadata: Metadata = {
  title: '주식회사 루소 | 의류 도매 및 생산 전문',
  description: '저희는 베트남, 중국, 인도네시아, 방글라데시 등 현지 대량 생산 기반으로 고품질 의류를 합리적인 가격에 공급하는 전문 도매업체입니다.',
  keywords: '의류도매, 의류생산, 베트남의류, 중국의류, 인도네시아의류, 방글라데시의류, 도매전문, 루소',
  authors: [{ name: "주식회사 루소" }],
  creator: "주식회사 루소",
  publisher: "주식회사 루소",
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
    title: '주식회사 루소 | 의류 도매 및 생산 전문',
    description: '저희는 베트남, 중국, 인도네시아, 방글라데시 등 현지 대량 생산 기반으로 고품질 의류를 합리적인 가격에 공급하는 전문 도매업체입니다.',
    type: 'website',
    locale: 'ko_KR',
    siteName: '주식회사 루소',
    images: [
      {
        url: '/images/opengraph_image.jpeg',
        width: 1200,
        height: 630,
        alt: '주식회사 루소 - 의류 도매 및 생산 전문',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '주식회사 루소 | 의류 도매 및 생산 전문',
    description: '저희는 베트남, 중국, 인도네시아, 방글라데시 등 현지 대량 생산 기반으로 고품질 의류를 합리적인 가격에 공급하는 전문 도매업체입니다.'
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
      <body className="antialiased">
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
