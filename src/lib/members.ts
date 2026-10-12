export type Role = "admin" | "member";

export const ROLE_LABEL: Record<Role, string> = { admin: "관리자", member: "멤버" };

/** 가입한 멤버(프로필) */
export interface MemberRow {
  id: string;
  email: string;
  name: string;
  role: Role;
}

/** 초대 목록의 한 줄 */
export interface InvitationRow {
  email: string;
  role: Role;
  /** 가입으로 초대가 수락된 시각 (아직 가입 전이면 null) */
  accepted_at: string | null;
}

/** 멤버 관리 화면의 한 줄 (가입한 멤버 또는 아직 가입하지 않은 초대) */
export interface MemberListItem {
  key: string;
  email: string;
  name: string | null;
  role: Role;
  status: "joined" | "invited";
  /** 가입한 멤버일 때만 있음 */
  memberId?: string;
}

/** 가입한 멤버(관리자 먼저, 이름순)와 아직 가입하지 않은 초대(이메일순)를 한 목록으로 합친다. */
export function buildList(members: MemberRow[], invitations: InvitationRow[]): MemberListItem[] {
  const joinedEmails = new Set(members.map((m) => m.email.toLowerCase()));

  const joined: MemberListItem[] = [...members]
    .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name, "ko") : a.role === "admin" ? -1 : 1))
    .map((m) => ({
      key: `m:${m.id}`,
      email: m.email,
      name: m.name,
      role: m.role,
      status: "joined" as const,
      memberId: m.id,
    }));

  const pending: MemberListItem[] = invitations
    .filter((i) => i.accepted_at === null && !joinedEmails.has(i.email.toLowerCase()))
    .sort((a, b) => a.email.localeCompare(b.email))
    .map((i) => ({
      key: `i:${i.email}`,
      email: i.email,
      name: null,
      role: i.role,
      status: "invited" as const,
    }));

  return [...joined, ...pending];
}

export const normalizeEmail = (s: string) => s.trim().toLowerCase();

/** 간단한 이메일 형식 검사 (최종 확인은 가입 때 이메일 확인 메일로 이뤄진다) */
export function isValidEmail(s: string): boolean {
  const e = normalizeEmail(s);
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

/** DB·API 오류를 사용자에게 보여줄 한국어 안내로 바꾼다 */
export function describeError(error: { message?: string; code?: string } | null | undefined): string {
  const message = error?.message ?? "";
  if (message.includes("LAST_ADMIN")) return "마지막 관리자는 강등하거나 내보낼 수 없습니다.";
  if (message.includes("SELF")) return "자기 자신은 내보낼 수 없습니다.";
  if (message.includes("FORBIDDEN")) return "관리자만 할 수 있는 작업입니다.";
  if (message.includes("NOT_FOUND")) return "이미 삭제된 멤버입니다. 목록을 새로 불러옵니다.";
  if (error?.code === "23505" || message.includes("duplicate key")) return "이미 초대했거나 가입한 이메일입니다.";
  return "처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}
