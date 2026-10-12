import { createClient } from "@/lib/supabase/client";
import { describeError, normalizeEmail, type Role } from "@/lib/members";

/**
 * 멤버 관리 화면이 DB 에 보내는 요청 (브라우저에서 로그인한 관리자의 권한으로 실행됨).
 * 실제 권한 판단은 DB 의 접근 제어(RLS)와 함수가 한다. 성공하면 null, 실패하면 안내 문구를 돌려준다.
 */

/** 이메일을 초대 목록에 추가한다 */
export async function inviteMember(email: string, role: Role): Promise<string | null> {
  const { error } = await createClient()
    .from("invitations")
    .insert({ email: normalizeEmail(email), role });
  return error ? describeError(error) : null;
}

/** 아직 가입하지 않은 초대를 취소한다 */
export async function cancelInvitation(email: string): Promise<string | null> {
  const { data, error } = await createClient()
    .from("invitations")
    .delete()
    .eq("email", normalizeEmail(email))
    .is("accepted_at", null)
    .select("email");
  if (error) return describeError(error);
  return (data?.length ?? 0) === 0 ? "이미 가입했거나 취소된 초대입니다. 목록을 새로 불러옵니다." : null;
}

/** 멤버의 역할을 바꾼다 (마지막 관리자는 DB 가 거절함) */
export async function changeRole(memberId: string, role: Role): Promise<string | null> {
  const { error } = await createClient().rpc("set_member_role", { target: memberId, new_role: role });
  return error ? describeError(error) : null;
}

/** 멤버를 내보낸다 (계정·프로필·초대와 그 사람이 쓴 댓글이 함께 삭제됨) */
export async function removeMember(memberId: string): Promise<string | null> {
  const { error } = await createClient().rpc("remove_member", { target: memberId });
  return error ? describeError(error) : null;
}
