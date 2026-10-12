import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 오류는 문구가 아니라 코드로만 전달한다 (로그인 페이지가 고정 문구로 변환)
const login = (origin: string, error: "not_invited" | "failed") =>
  NextResponse.redirect(`${origin}/login?error=${error}`);

// OAuth / 이메일 확인 링크의 콜백
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // 초대받지 않은 이메일이면 DB 트리거가 가입을 거부하고 에러가 여기로 전달됨
  if (searchParams.get("error_description")) return login(origin, "not_invited");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/`);
  }

  return login(origin, "failed");
}
