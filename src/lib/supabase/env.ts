/** Supabase 환경변수가 없으면 로컬 데모 모드(인증 없음, localStorage)로 동작 */
export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
