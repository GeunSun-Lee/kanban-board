import type { NextConfig } from "next";

// 배포(Vercel) 빌드에서 Supabase 환경변수가 빠지면 인증 없는 데모 모드로 공개되므로 빌드를 실패시킨다.
// (NEXT_PUBLIC_ 값은 빌드 시점에 코드에 박히므로 나중에 고칠 수 없다)
if (
  process.env.VERCEL_ENV &&
  !(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 설정되지 않았습니다. Vercel 환경변수를 확인하세요.",
  );
}

const securityHeaders = [
  // 클릭재킹 방지: 다른 사이트의 iframe 안에서 열리지 않게 한다
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // 팀 내부용이므로 검색엔진에 노출하지 않는다
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
