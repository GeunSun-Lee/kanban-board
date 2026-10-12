import { redirect } from "next/navigation";
import { Suspense } from "react";
import { MembersManager } from "@/components/members/members-manager";
import { buildList, type InvitationRow, type MemberRow } from "@/lib/members";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export default function MembersPage() {
  // 데모 모드에는 로그인과 멤버 개념이 없으므로 홈으로 보낸다
  if (!isSupabaseConfigured) redirect("/");

  return (
    <Suspense fallback={<p className="p-6 text-sm text-zinc-400">불러오는 중…</p>}>
      <MembersContent />
    </Suspense>
  );
}

// 세션과 DB 를 읽으므로 요청 시점에 실행된다 (Cache Components)
async function MembersContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 화면 이동용 확인일 뿐이고, 실제 권한은 DB 의 접근 제어가 판단한다
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "admin") redirect("/");

  const [members, invitations] = await Promise.all([
    supabase.from("profiles").select("id, email, name, role").order("created_at"),
    supabase.from("invitations").select("email, role, accepted_at").order("created_at"),
  ]);

  if (members.error || invitations.error) {
    return (
      <main className="mx-auto w-full max-w-3xl p-6">
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          멤버 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
        </p>
      </main>
    );
  }

  const items = buildList(members.data as MemberRow[], invitations.data as InvitationRow[]);
  return <MembersManager items={items} myId={user.id} />;
}
