"use client";

import { useEffect, useRef } from "react";
import type { Activity, Member } from "@/lib/types";
import { ActivityList } from "./activity-list";

/** 우측 슬라이드 패널 (모달 dialog) */
export function ActivityPanel({
  items,
  members,
  existingCardIds,
  onOpenCard,
  onClose,
}: {
  items: Activity[];
  members: Member[];
  existingCardIds: Set<string>;
  onOpenCard: (cardId: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      aria-label="보드 활동"
      className="m-0 ml-auto h-dvh max-h-dvh w-[min(24rem,100vw)] rounded-none border-l border-zinc-200 bg-white p-0 text-zinc-900 backdrop:bg-black/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
    >
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h2 className="font-semibold">활동</h2>
          <button
            type="button"
            aria-label="닫기"
            className="rounded p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            onClick={() => ref.current?.close()}
          >
            ✕
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-4">
          <ActivityList
            items={items}
            members={members}
            existingCardIds={existingCardIds}
            onOpenCard={(id) => {
              ref.current?.close();
              onOpenCard(id);
            }}
          />
        </div>
      </div>
    </dialog>
  );
}
