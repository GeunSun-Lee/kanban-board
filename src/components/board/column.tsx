"use client";

import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { addCard, deleteColumn, updateColumn } from "@/lib/demo-store";
import { useUndoToast } from "@/components/toast";
import type { Card, Column as ColumnType, Label, Member } from "@/lib/types";
import { CardView } from "./card-view";

function SortableCard({
  card,
  members,
  labels,
  commentCount,
  done,
  disabled,
  onOpen,
}: {
  card: Card;
  members: Member[];
  labels: Label[];
  commentCount: number;
  done: boolean;
  disabled: boolean;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: "card" },
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`cursor-pointer touch-manipulation rounded-md outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        isDragging ? "opacity-40" : ""
      }`}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      onKeyDown={(e) => {
        // Enter: 상세 열기 / Space: dnd-kit 키보드 드래그 시작
        if (e.key === "Enter") onOpen();
        else listeners?.onKeyDown?.(e);
      }}
    >
      <CardView card={card} members={members} labels={labels} commentCount={commentCount} done={done} />
    </div>
  );
}

export function Column({
  column,
  cards,
  totalCount,
  members,
  labels,
  commentCounts,
  isLast,
  canDelete,
  dragDisabled,
  onOpenCard,
}: {
  column: ColumnType;
  /** 필터가 적용된 표시용 카드 */
  cards: Card[];
  /** 필터와 무관한 컬럼의 실제 카드 수(WIP 계산용) */
  totalCount: number;
  members: Member[];
  labels: Label[];
  commentCounts: Map<string, number>;
  isLast: boolean;
  /** 컬럼 삭제는 관리자만 (RLS가 강제) */
  canDelete: boolean;
  dragDisabled: boolean;
  onOpenCard: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: column.id, data: { type: "column" }, disabled: dragDisabled });

  const undoToast = useUndoToast();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const overWip = column.wipLimit !== null && totalCount > column.wipLimit;

  function submit() {
    const t = title.trim();
    if (t) addCard(column.id, t);
    setTitle("");
  }

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      aria-label={column.name}
      className={`flex max-h-full w-72 shrink-0 flex-col rounded-xl border bg-zinc-100 dark:bg-zinc-900 ${
        overWip ? "border-red-400 dark:border-red-700" : "border-zinc-200 dark:border-zinc-800"
      } ${isDragging ? "opacity-50" : ""}`}
    >
      <header className="flex items-center gap-1 px-2 pt-2">
        <button
          type="button"
          ref={setActivatorNodeRef}
          disabled={dragDisabled}
          aria-label={`${column.name} 컬럼 이동`}
          title={dragDisabled ? "필터를 해제하면 이동할 수 있습니다" : "드래그하여 컬럼 순서 변경"}
          className="cursor-grab touch-none rounded px-1 text-zinc-400 hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-zinc-800"
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
        <input
          key={column.name}
          defaultValue={column.name}
          maxLength={50}
          aria-label="컬럼 이름"
          className="min-w-0 flex-1 rounded bg-transparent px-1 py-0.5 text-sm font-semibold outline-none focus:bg-white dark:focus:bg-zinc-800"
          onBlur={(e) => {
            const name = e.target.value.trim();
            if (name && name !== column.name) updateColumn(column.id, { name });
            else e.target.value = column.name;
          }}
        />
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${
            overWip ? "bg-red-100 font-medium text-red-700 dark:bg-red-950 dark:text-red-300" : "text-zinc-500"
          }`}
          title={overWip ? "WIP 제한 초과" : undefined}
        >
          {totalCount}
          {column.wipLimit !== null && ` / ${column.wipLimit}`}
        </span>
        <details className="relative">
          <summary
            aria-label={`${column.name} 설정`}
            className="cursor-pointer list-none rounded px-1.5 py-0.5 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
          >
            ⋯
          </summary>
          <div className="absolute right-0 z-20 mt-1 w-52 space-y-3 rounded-lg border border-zinc-200 bg-white p-3 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
            <label className="block space-y-1">
              <span className="text-xs text-zinc-500">WIP 제한 (비우면 없음)</span>
              <input
                type="number"
                min={1}
                defaultValue={column.wipLimit ?? ""}
                className="w-full rounded-md border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-600"
                onBlur={(e) => {
                  const n = parseInt(e.target.value, 10);
                  updateColumn(column.id, { wipLimit: Number.isFinite(n) && n > 0 ? n : null });
                }}
              />
            </label>
            {canDelete && (
              <button
                type="button"
                className="w-full rounded-md px-2 py-1 text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                onClick={() => {
                  const undo = deleteColumn(column.id);
                  undoToast(`"${column.name}" 컬럼을 삭제했습니다 (카드 ${totalCount}개)`, undo);
                }}
              >
                컬럼 삭제
              </button>
            )}
          </div>
        </details>
      </header>

      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-12 flex-1 flex-col gap-2 overflow-y-auto p-2">
          {cards.map((card) => (
            <SortableCard
              key={card.id}
              card={card}
              members={members}
              labels={labels}
              commentCount={commentCounts.get(card.id) ?? 0}
              done={isLast}
              disabled={dragDisabled}
              onOpen={() => onOpenCard(card.id)}
            />
          ))}
        </div>
      </SortableContext>

      <footer className="p-2 pt-0">
        {adding ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="space-y-2"
          >
            <textarea
              autoFocus
              value={title}
              maxLength={200}
              rows={2}
              placeholder="카드 제목 (Enter로 추가)"
              aria-label="새 카드 제목"
              className="w-full resize-none rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800"
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                } else if (e.key === "Escape") {
                  setTitle("");
                  setAdding(false);
                }
              }}
            />
            <div className="flex gap-2">
              <button className="rounded-md bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700">
                추가
              </button>
              <button
                type="button"
                className="rounded-md px-3 py-1 text-sm text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                onClick={() => {
                  setTitle("");
                  setAdding(false);
                }}
              >
                취소
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            className="w-full rounded-md px-2 py-1.5 text-left text-sm text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
            onClick={() => setAdding(true)}
          >
            + 카드 추가
          </button>
        )}
      </footer>
    </section>
  );
}
