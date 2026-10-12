"use client";

import Link from "next/link";
import { useState } from "react";
import { isValidEmail, ROLE_LABEL, type MemberListItem, type Role } from "@/lib/members";

export interface MembersViewProps {
  items: MemberListItem[];
  /** 지금 로그인한 관리자 (자기 자신은 역할 변경·내보내기를 할 수 없음) */
  myId: string;
  busy: boolean;
  message: { type: "error" | "info"; text: string } | null;
  onInvite: (email: string, role: Role) => Promise<boolean>;
  onChangeRole: (item: MemberListItem, role: Role) => void;
  onRemove: (item: MemberListItem) => void;
  onCancelInvite: (item: MemberListItem) => void;
}

const field =
  "rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-zinc-700";

export function MembersView({ items, myId, busy, message, onInvite, onChangeRole, onRemove, onCancelInvite }: MembersViewProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [formError, setFormError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setFormError("이메일 형식이 올바르지 않습니다.");
      return;
    }
    setFormError(null);
    if (await onInvite(email, role)) {
      setEmail("");
      setRole("member");
    }
  }

  const joinedCount = items.filter((i) => i.status === "joined").length;
  const invitedCount = items.length - joinedCount;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <header className="space-y-1">
        <Link href="/" className="text-sm text-zinc-500 hover:underline">
          ← 보드 목록
        </Link>
        <h1 className="text-xl font-semibold">멤버 관리</h1>
        <p className="text-sm text-zinc-500">
          초대한 이메일로만 가입할 수 있습니다. 관리자만 이 화면을 볼 수 있습니다.
        </p>
      </header>

      <section aria-label="멤버 초대" className="space-y-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-sm font-semibold">멤버 초대</h2>
        <form onSubmit={submit} className="flex flex-wrap items-start gap-2">
          <div className="min-w-0 flex-1 basis-56">
            <input
              type="email"
              value={email}
              maxLength={254}
              placeholder="초대할 이메일"
              aria-label="초대할 이메일"
              aria-invalid={formError ? true : undefined}
              className={`${field} w-full`}
              onChange={(e) => {
                setEmail(e.target.value);
                setFormError(null);
              }}
            />
            {formError && (
              <p role="alert" className="mt-1 text-xs text-red-600">
                {formError}
              </p>
            )}
          </div>
          <select
            value={role}
            aria-label="초대할 역할"
            className={field}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            <option value="member" className="text-zinc-900">
              멤버
            </option>
            <option value="admin" className="text-zinc-900">
              관리자
            </option>
          </select>
          <button
            disabled={busy || !email.trim()}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
          >
            초대
          </button>
        </form>
      </section>

      {message && (
        <p
          role={message.type === "error" ? "alert" : "status"}
          className={`rounded-md p-3 text-sm ${
            message.type === "error"
              ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
              : "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
          }`}
        >
          {message.text}
        </p>
      )}

      <section aria-label="멤버 목록" className="space-y-2">
        <h2 className="text-sm font-semibold">
          멤버 {joinedCount}명{invitedCount > 0 && ` · 가입 대기 ${invitedCount}명`}
        </h2>
        <ul className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {items.map((item) => {
            const isMe = item.memberId === myId;
            const label = item.name ?? item.email;
            return (
              <li key={item.key} className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3">
                <div className="min-w-0 flex-1 basis-48">
                  <p className="truncate text-sm font-medium">
                    {label}
                    {isMe && <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-normal text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">나</span>}
                  </p>
                  {item.name && <p className="truncate text-xs text-zinc-500">{item.email}</p>}
                </div>

                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    item.status === "joined"
                      ? "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  }`}
                >
                  {item.status === "joined" ? "가입함" : "초대됨"}
                </span>

                {item.status === "joined" ? (
                  <select
                    value={item.role}
                    disabled={busy || isMe}
                    aria-label={`${label}의 역할`}
                    title={isMe ? "자신의 역할은 바꿀 수 없습니다" : undefined}
                    className={`${field} py-1 disabled:opacity-60`}
                    onChange={(e) => onChangeRole(item, e.target.value as Role)}
                  >
                    <option value="member" className="text-zinc-900">
                      {ROLE_LABEL.member}
                    </option>
                    <option value="admin" className="text-zinc-900">
                      {ROLE_LABEL.admin}
                    </option>
                  </select>
                ) : (
                  <span className="px-3 text-sm text-zinc-500">{ROLE_LABEL[item.role]}</span>
                )}

                {item.status === "joined" ? (
                  <button
                    type="button"
                    disabled={busy || isMe}
                    aria-label={`${label} 내보내기`}
                    title={isMe ? "자기 자신은 내보낼 수 없습니다" : undefined}
                    className="rounded-md px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-red-950"
                    onClick={() => onRemove(item)}
                  >
                    내보내기
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    aria-label={`${label} 초대 취소`}
                    className="rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    onClick={() => onCancelInvite(item)}
                  >
                    초대 취소
                  </button>
                )}
              </li>
            );
          })}
          {items.length === 0 && <li className="p-4 text-sm text-zinc-400">아직 멤버가 없습니다.</li>}
        </ul>
      </section>
    </main>
  );
}
