"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  markAllNotificationsRead,
  markNotificationRead,
  refreshDueSoon,
  setPref,
  simulateNotification,
  useAppState,
} from "@/lib/demo-store";
import { relativeTime } from "@/lib/format";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { NotificationPrefs, NotificationType } from "@/lib/types";

const TEXT: Record<NotificationType, (actor: string) => string> = {
  assigned: (actor) => `${actor}님이 회원님을 담당자로 지정했습니다`,
  mention: (actor) => `${actor}님이 회원님을 멘션했습니다`,
  due_soon: () => "마감이 임박했습니다",
};

const PREF_LABELS: [keyof NotificationPrefs, string][] = [
  ["emailMention", "멘션되면 이메일 받기"],
  ["emailAssigned", "담당자로 지정되면 이메일 받기"],
  ["emailDue", "마감 임박 시 이메일 받기"],
];

export function NotificationBell() {
  const state = useAppState();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);

  const cards = state?.cards;
  useEffect(() => {
    // 변경이 있을 때만 커밋하므로 반복 갱신되지 않음
    if (cards) refreshDueSoon();
  }, [cards]);

  if (!state) return <div className="h-9 w-9" aria-hidden />;

  const mine = state.notifications.filter((n) => n.userId === state.me);
  const unread = mine.filter((n) => !n.read).length;

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`알림 ${unread}개 읽지 않음`}
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden>🔔</span>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-medium text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="알림 닫기"
            tabIndex={-1}
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-label="알림"
            className="fixed inset-x-4 top-14 z-40 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-88 sm:max-w-[calc(100vw-2rem)] rounded-xl border border-zinc-200 bg-white text-sm shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
            }}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
              <h2 className="font-semibold">알림</h2>
              <div className="flex gap-3 text-xs">
                <button type="button" className="text-blue-600 hover:underline" onClick={() => setShowPrefs((v) => !v)}>
                  {showPrefs ? "목록" : "이메일 설정"}
                </button>
                {unread > 0 && !showPrefs && (
                  <button type="button" className="text-blue-600 hover:underline" onClick={markAllNotificationsRead}>
                    모두 읽음
                  </button>
                )}
              </div>
            </div>

            {showPrefs ? (
              <div className="space-y-3 p-4">
                {PREF_LABELS.map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2">
                    <input type="checkbox" checked={state.prefs[key]} onChange={(e) => setPref(key, e.target.checked)} />
                    {label}
                  </label>
                ))}
                <p className="text-xs text-zinc-400">
                  {isSupabaseConfigured
                    ? "이메일 알림 발송은 M5에서 활성화됩니다. 설정은 지금부터 저장됩니다."
                    : "데모 모드에서는 실제 메일이 발송되지 않습니다."}
                </p>
              </div>
            ) : (
              <ul className="max-h-96 overflow-y-auto">
                {mine.length === 0 && <li className="p-4 text-zinc-400">알림이 없습니다.</li>}
                {mine.map((n) => {
                  const actor = state.members.find((m) => m.id === n.actorId)?.name ?? "";
                  const exists = state.cards.some((c) => c.id === n.cardId);
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        className={`flex w-full gap-2 border-b border-zinc-100 px-4 py-2.5 text-left hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800 ${
                          n.read ? "opacity-60" : ""
                        }`}
                        onClick={() => {
                          markNotificationRead(n.id);
                          setOpen(false);
                          if (exists) router.push(`/boards/${n.boardId}?card=${n.cardId}`);
                        }}
                      >
                        <span
                          aria-hidden
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-blue-500"}`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block">{TEXT[n.type](actor)}</span>
                          <span className="block truncate font-medium">
                            {n.cardTitle}
                            {!exists && " (삭제됨)"}
                          </span>
                          <time dateTime={n.createdAt} className="text-xs text-zinc-400">
                            {relativeTime(n.createdAt)}
                          </time>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {!showPrefs && !isSupabaseConfigured && (
              <div className="border-t border-zinc-200 px-4 py-2 text-right dark:border-zinc-800">
                <button
                  type="button"
                  className="text-xs text-zinc-500 hover:underline"
                  title="데모 전용: 동료가 보낸 것처럼 알림을 만듭니다"
                  onClick={simulateNotification}
                >
                  데모 알림 만들기
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
