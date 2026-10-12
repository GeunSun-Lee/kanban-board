import { relativeTime } from "@/lib/format";
import type { Activity, Member } from "@/lib/types";

function describe(a: Activity) {
  const t = `"${a.cardTitle}"`;
  switch (a.action) {
    case "card_created":
      return `카드 ${t} 생성${a.detail ? ` (${a.detail})` : ""}`;
    case "card_moved":
      return `카드 ${t} 이동: ${a.detail ?? ""}`;
    case "card_deleted":
      return `카드 ${t} 삭제`;
    case "assigned":
      return `${t} 카드에 ${a.detail ?? ""}님을 담당자로 지정`;
    case "comment_added":
      return `${t} 카드에 댓글: ${a.detail ?? ""}`;
  }
}

export function ActivityList({
  items,
  members,
  existingCardIds,
  onOpenCard,
}: {
  items: Activity[];
  members: Member[];
  /** 아직 존재하는 카드 ID (삭제된 카드는 열 수 없음) */
  existingCardIds?: Set<string>;
  onOpenCard?: (cardId: string) => void;
}) {
  if (items.length === 0) return <p className="text-sm text-zinc-400">아직 활동이 없습니다.</p>;

  return (
    <ul className="space-y-3">
      {items.map((a) => {
        const name = members.find((m) => m.id === a.userId)?.name ?? "알 수 없음";
        const openable = onOpenCard && existingCardIds?.has(a.cardId) && a.action !== "card_deleted";
        const body = (
          <>
            <span className="font-medium">{name}</span>
            <span className="text-zinc-600 dark:text-zinc-300"> · {describe(a)}</span>
          </>
        );
        return (
          <li key={a.id} className="text-sm">
            {openable ? (
              <button type="button" className="text-left hover:underline" onClick={() => onOpenCard(a.cardId)}>
                {body}
              </button>
            ) : (
              <p>{body}</p>
            )}
            <time dateTime={a.createdAt} className="block text-xs text-zinc-400">
              {relativeTime(a.createdAt)}
            </time>
          </li>
        );
      })}
    </ul>
  );
}
