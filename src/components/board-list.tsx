"use client";

import Link from "next/link";
import { useState } from "react";
import { useUndoToast } from "@/components/toast";
import { createBoard, deleteBoard, useAppState } from "@/lib/demo-store";

export function BoardList() {
  const state = useAppState();
  const undoToast = useUndoToast();
  const [name, setName] = useState("");

  if (!state) return <p className="text-sm text-zinc-400">불러오는 중…</p>;

  const boards = state.boards.filter((b) => !b.archived);

  return (
    <section className="space-y-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = name.trim();
          if (!trimmed) return;
          createBoard(trimmed);
          setName("");
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          placeholder="새 보드 이름"
          aria-label="새 보드 이름"
          className="flex-1 rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-zinc-700"
        />
        <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          보드 만들기
        </button>
      </form>

      {boards.length === 0 ? (
        <p className="text-sm text-zinc-500">아직 보드가 없습니다. 첫 보드를 만들어 보세요.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {boards.map((b) => {
            const count = state.cards.filter((c) => c.boardId === b.id).length;
            return (
              <li
                key={b.id}
                className="group flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <Link href={`/boards/${b.id}`} className="flex-1">
                  <div className="font-medium">{b.name}</div>
                  <div className="mt-1 text-xs text-zinc-500">카드 {count}개</div>
                </Link>
                {state.isAdmin && (
                <button
                  type="button"
                  aria-label={`${b.name} 삭제`}
                  className="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                  onClick={() => {
                    const undo = deleteBoard(b.id);
                    undoToast(`"${b.name}" 보드를 삭제했습니다`, undo);
                  }}
                >
                  삭제
                </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
