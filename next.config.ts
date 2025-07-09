import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  
  // 시간대 설정 (한국시간)
  env: {
    TZ: 'Asia/Seoul'
  },
  
  // Vercel 환경에서 Chromium 사용을 위한 설정
  serverExternalPackages: ['@supabase/supabase-js', '@sparticuz/chromium-min', 'puppeteer-core']
};

export default nextConfig;
