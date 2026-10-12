import Link from "next/link";
import { Suspense } from "react";
import { BoardList } from "@/components/board-list";
import { NotificationBell } from "@/components/notification-bell";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">칸반 보드</h1>
        <div className="flex items-center gap-3">
          <NotificationBell />
          {isSupabaseConfigured ? (
          <Suspense fallback={null}>
            <UserMenu />
          </Suspense>
        ) : (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            데모 모드 · 이 브라우저에만 저장됨
          </span>
        )}
        </div>
      </header>
      <BoardList />
    </main>
  );
}

// 세션을 읽으므로 요청 시점에 스트리밍됨 (Cache Components)
async function UserMenu() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, role")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  return (
    <div className="flex items-center gap-3 text-sm">
      {profile?.role === "admin" && (
        <Link href="/members" className="rounded-md px-2 py-1 text-blue-600 hover:underline">
          멤버 관리
        </Link>
      )}
      <span className="text-zinc-500">{profile?.name}</span>
      <form action="/auth/signout" method="post">
        <button className="rounded-md border border-zinc-300 px-3 py-1.5 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
          로그아웃
        </button>
      </form>
    </div>
  );
}
