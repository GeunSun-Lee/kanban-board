"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cancelInvitation, changeRole, inviteMember, removeMember } from "@/lib/admin-api";
import { ROLE_LABEL, type MemberListItem, type Role } from "@/lib/members";
import { useToast } from "@/components/toast";
import { MembersView } from "./members-view";

/** 멤버 관리: 요청을 보내고, 끝나면 서버에서 목록을 다시 받아 온다 */
export function MembersManager({ items, myId }: { items: MemberListItem[]; myId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "info"; text: string } | null>(null);

  async function run(action: () => Promise<string | null>, success: string): Promise<boolean> {
    setBusy(true);
    const error = await action();
    setBusy(false);
    if (error) {
      setMessage({ type: "error", text: error });
    } else {
      setMessage(null);
      toast(success);
    }
    router.refresh(); // 성공이든 실패든 서버의 최신 목록으로 맞춘다
    return error === null;
  }

  return (
    <MembersView
      items={items}
      myId={myId}
      busy={busy}
      message={message}
      onInvite={(email, role) => run(() => inviteMember(email, role), "초대했습니다. 이 이메일로 가입할 수 있습니다.")}
      onChangeRole={(item: MemberListItem, role: Role) => {
        if (!item.memberId) return;
        const memberId = item.memberId;
        void run(() => changeRole(memberId, role), `${item.name ?? item.email}님의 역할을 ${ROLE_LABEL[role]}(으)로 바꿨습니다.`);
      }}
      onRemove={(item) => {
        if (!item.memberId) return;
        const memberId = item.memberId;
        const who = item.name ?? item.email;
        const ok = window.confirm(
          `${who}님을 내보낼까요?\n\n계정이 삭제되고, 이 사람이 쓴 댓글과 담당자 지정도 함께 삭제됩니다. 되돌릴 수 없습니다.\n같은 이메일로 다시 가입시키려면 새로 초대해야 합니다.`,
        );
        if (ok) void run(() => removeMember(memberId), `${who}님을 내보냈습니다.`);
      }}
      onCancelInvite={(item) => {
        void run(() => cancelInvitation(item.email), `${item.email} 초대를 취소했습니다.`);
      }}
    />
  );
}
