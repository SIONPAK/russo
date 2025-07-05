import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  
  // 시간대 설정 (한국시간)
  env: {
    TZ: 'Asia/Seoul'
  },
  
  // 서버 측 렌더링 시 시간대 설정
  experimental: {
    serverComponentsExternalPackages: ['@supabase/supabase-js']
  }
};

export default nextConfig;
