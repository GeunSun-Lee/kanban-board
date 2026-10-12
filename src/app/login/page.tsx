import { redirect } from "next/navigation";
import { Suspense } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { LoginForm } from "./login-form";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // 데모 모드(Supabase 미연결)에는 로그인이 없음
  if (!isSupabaseConfigured) redirect("/");

  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-xl font-semibold">칸반 보드</h1>
        <p className="mt-1 text-sm text-zinc-500">초대받은 팀원만 가입할 수 있습니다.</p>
        <Suspense>
          <ErrorMessage searchParams={searchParams} />
        </Suspense>
        <LoginForm />
      </div>
    </main>
  );
}

const ERROR_MESSAGES: Record<string, string> = {
  not_invited: "가입할 수 없습니다. 초대받은 이메일인지 확인해 주세요.",
  failed: "로그인에 실패했습니다. 다시 시도해 주세요.",
};

async function ErrorMessage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error: code } = await searchParams;
  // 임의 문구가 화면에 그대로 나오지 않도록 알려진 코드만 허용
  const error = code ? ERROR_MESSAGES[code] : undefined;
  if (!error) return null;
  return (
    <p role="alert" className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
      {error}
    </p>
  );
}
