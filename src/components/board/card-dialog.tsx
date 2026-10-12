"use client";

import { useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/markdown";
import { useUndoToast } from "@/components/toast";
import { deleteCard, updateCard } from "@/lib/demo-store";
import {
  PRIORITIES,
  type Activity,
  type Card,
  type Comment,
  type Label,
  type Member,
  type Priority,
} from "@/lib/types";
import { ActivityList } from "./activity-list";
import { ChecklistSection, CommentsSection, LabelsSection } from "./card-sections";

const field =
  "w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-zinc-700";

export function CardDialog({
  card,
  columnName,
  members,
  labels,
  comments,
  activity,
  me,
  onClose,
}: {
  card: Card;
  columnName: string;
  members: Member[];
  /** 이 보드의 라벨 */
  labels: Label[];
  /** 이 카드의 댓글(오래된 순) */
  comments: Comment[];
  /** 이 카드의 활동(최신순) */
  activity: Activity[];
  me: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const undoToast = useUndoToast();
  const [descMode, setDescMode] = useState<"edit" | "preview">(card.description ? "preview" : "edit");

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  function toggleAssignee(id: string) {
    const next = card.assigneeIds.includes(id)
      ? card.assigneeIds.filter((a) => a !== id)
      : [...card.assigneeIds, id];
    updateCard(card.id, { assigneeIds: next });
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close(); // 배경 클릭 시 닫기
      }}
      aria-label="카드 상세"
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(36rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-zinc-200 bg-white p-0 text-zinc-900 backdrop:bg-black/40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
    >
      <div className="space-y-5 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-1">
            <input
              key={`${card.id}-title`}
              defaultValue={card.title}
              maxLength={200}
              aria-label="제목"
              className={`${field} text-base font-semibold`}
              onBlur={(e) => {
                const title = e.target.value.trim();
                if (title && title !== card.title) updateCard(card.id, { title });
                else e.target.value = card.title;
              }}
            />
            <p className="px-1 text-xs text-zinc-500">{columnName} 컬럼</p>
          </div>
          <button
            type="button"
            aria-label="닫기"
            className="rounded p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            onClick={() => ref.current?.close()}
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-zinc-500">우선순위</span>
            <select
              value={card.priority}
              className={field}
              onChange={(e) => updateCard(card.id, { priority: e.target.value as Priority })}
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value} className="text-zinc-900">
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-zinc-500">마감일</span>
            <input
              type="date"
              value={card.dueDate ?? ""}
              className={field}
              onChange={(e) => updateCard(card.id, { dueDate: e.target.value || null })}
            />
          </label>
        </div>

        <fieldset className="space-y-1">
          <legend className="text-xs font-medium text-zinc-500">담당자</legend>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => {
              const on = card.assigneeIds.includes(m.id);
              return (
                <label
                  key={m.id}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm focus-within:ring-2 focus-within:ring-blue-500 ${
                    on
                      ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                      : "border-zinc-300 dark:border-zinc-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={on}
                    onChange={() => toggleAssignee(m.id)}
                  />
                  {m.name}
                </label>
              );
            })}
          </div>
        </fieldset>

        <LabelsSection card={card} labels={labels} />

        <section className="space-y-1" aria-label="설명">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium text-zinc-500">설명 (마크다운 지원)</h3>
            <div role="tablist" aria-label="설명 보기 방식" className="flex gap-1 text-xs">
              {(["edit", "preview"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  role="tab"
                  aria-selected={descMode === mode}
                  className={`rounded px-2 py-0.5 ${
                    descMode === mode
                      ? "bg-zinc-200 font-medium dark:bg-zinc-700"
                      : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                  onClick={() => setDescMode(mode)}
                >
                  {mode === "edit" ? "편집" : "미리보기"}
                </button>
              ))}
            </div>
          </div>
          {descMode === "edit" ? (
            <textarea
              key={`${card.id}-desc`}
              defaultValue={card.description}
              rows={5}
              maxLength={20000}
              aria-label="설명"
              className={`${field} font-mono`}
              placeholder={"설명을 입력하세요\n**굵게**, - 목록, `코드`, [링크](https://...) 사용 가능"}
              onBlur={(e) => {
                if (e.target.value !== card.description) updateCard(card.id, { description: e.target.value });
              }}
            />
          ) : (
            <div className="min-h-20 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
              {card.description.trim() ? (
                <Markdown>{card.description}</Markdown>
              ) : (
                <p className="text-sm text-zinc-400">설명이 없습니다. 편집 탭에서 입력하세요.</p>
              )}
            </div>
          )}
        </section>

        <ChecklistSection card={card} />

        <hr className="border-zinc-200 dark:border-zinc-800" />

        <CommentsSection cardId={card.id} comments={comments} members={members} me={me} />

        <details className="rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800">
          <summary className="cursor-pointer text-xs font-medium text-zinc-500">
            활동 기록 ({activity.length})
          </summary>
          <div className="mt-3">
            <ActivityList items={activity.slice(0, 20)} members={members} />
          </div>
        </details>

        <div className="flex items-center justify-between border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <button
            type="button"
            className="rounded-md px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
            onClick={() => {
              const undo = deleteCard(card.id);
              ref.current?.close();
              // 카드가 사라지면 다이얼로그가 바로 언마운트되어 close 이벤트가 오지 않으므로 직접 알림
              onClose();
              undoToast(`"${card.title}" 카드를 삭제했습니다`, undo);
            }}
          >
            카드 삭제
          </button>
          <p className="text-xs text-zinc-400">변경 사항은 자동 저장됩니다</p>
        </div>
      </div>
    </dialog>
  );
}
