import { LABEL_COLORS, PRIORITIES, type Card, type Label, type Member } from "@/lib/types";

const today = () => new Date().toLocaleDateString("sv"); // YYYY-MM-DD (로컬 시간)

export function initials(name: string) {
  return name.slice(0, 1);
}

export function LabelChip({ label, className = "" }: { label: Label; className?: string }) {
  const color = LABEL_COLORS.find((c) => c.value === label.color)!;
  return (
    <span className={`inline-block max-w-full truncate rounded px-1.5 py-0.5 text-xs ${color.className} ${className}`}>
      {label.name}
    </span>
  );
}

/** 카드 표시용(드래그 오버레이와 공용) */
export function CardView({
  card,
  members,
  labels,
  commentCount,
  done,
}: {
  card: Card;
  members: Member[];
  labels: Label[];
  commentCount: number;
  /** 마지막 컬럼 등 완료 상태면 마감 경고를 숨김 */
  done?: boolean;
}) {
  const priority = PRIORITIES.find((p) => p.value === card.priority)!;
  const overdue = !done && card.dueDate !== null && card.dueDate < today();
  const assignees = members.filter((m) => card.assigneeIds.includes(m.id));
  const cardLabels = labels.filter((l) => card.labelIds.includes(l.id));
  const checkDone = card.checklist.filter((i) => i.done).length;
  const checkAll = card.checklist.length;

  return (
    <div className="space-y-2 rounded-md border border-zinc-200 bg-white p-3 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
      {cardLabels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {cardLabels.map((l) => (
            <LabelChip key={l.id} label={l} />
          ))}
        </div>
      )}
      <div className="break-words font-medium">{card.title}</div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={`rounded px-1.5 py-0.5 text-xs ${priority.className}`}>{priority.label}</span>
          {card.dueDate && (
            <span
              className={`text-xs ${overdue ? "font-medium text-red-600 dark:text-red-400" : "text-zinc-500"}`}
            >
              {overdue ? "기한 초과 " : ""}
              {card.dueDate.slice(5).replace("-", "/")}
            </span>
          )}
          {checkAll > 0 && (
            <span
              className={`text-xs ${
                checkDone === checkAll ? "font-medium text-green-600 dark:text-green-400" : "text-zinc-500"
              }`}
              title="체크리스트"
            >
              ✓ {checkDone}/{checkAll}
            </span>
          )}
          {commentCount > 0 && (
            <span className="text-xs text-zinc-500" title="댓글">
              💬 {commentCount}
            </span>
          )}
        </div>
        {assignees.length > 0 && (
          <div className="flex -space-x-1.5">
            {assignees.map((m) => (
              <span
                key={m.id}
                title={m.name}
                className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-zinc-200 text-[10px] font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-600 dark:text-zinc-100"
              >
                {initials(m.name)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
