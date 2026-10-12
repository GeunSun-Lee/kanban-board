"use client";

import { useRef, useState } from "react";
import {
  addComment,
  createLabel,
  deleteComment,
  deleteLabel,
  newChecklistItem,
  updateCard,
} from "@/lib/demo-store";
import { LABEL_COLORS, type Card, type Comment, type Label, type LabelColor, type Member } from "@/lib/types";
import { relativeTime } from "@/lib/format";
import { splitMentions } from "@/lib/mentions";
import { initials, LabelChip } from "./card-view";

const field =
  "w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-zinc-700";

// ---------------------------------------------------------------
// 라벨
// ---------------------------------------------------------------
export function LabelsSection({ card, labels }: { card: Card; labels: Label[] }) {
  const [managing, setManaging] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<LabelColor>("blue");

  function toggle(id: string) {
    const next = card.labelIds.includes(id) ? card.labelIds.filter((l) => l !== id) : [...card.labelIds, id];
    updateCard(card.id, { labelIds: next });
  }

  return (
    <fieldset className="space-y-2">
      <div className="flex items-center justify-between">
        <legend className="text-xs font-medium text-zinc-500">라벨</legend>
        <button
          type="button"
          className="text-xs text-blue-600 hover:underline"
          onClick={() => setManaging((v) => !v)}
        >
          {managing ? "완료" : "라벨 관리"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {labels.length === 0 && <p className="text-sm text-zinc-400">라벨이 없습니다. 라벨 관리에서 만들어 보세요.</p>}
        {labels.map((l) => {
          const on = card.labelIds.includes(l.id);
          return (
            <span key={l.id} className="inline-flex items-center gap-1">
              <label
                className={`cursor-pointer rounded-md border-2 p-0.5 ${
                  on ? "border-blue-500" : "border-transparent opacity-60 hover:opacity-100"
                }`}
              >
                <input type="checkbox" className="sr-only" checked={on} onChange={() => toggle(l.id)} />
                <LabelChip label={l} />
              </label>
              {managing && (
                <button
                  type="button"
                  aria-label={`${l.name} 라벨 삭제`}
                  className="text-xs text-zinc-400 hover:text-red-600"
                  onClick={() => {
                    if (window.confirm(`"${l.name}" 라벨을 삭제할까요? 모든 카드에서 제거됩니다.`)) deleteLabel(l.id);
                  }}
                >
                  ✕
                </button>
              )}
            </span>
          );
        })}
      </div>

      {managing && (
        <form
          className="flex flex-wrap items-center gap-2 rounded-md bg-zinc-50 p-2 dark:bg-zinc-800/60"
          onSubmit={(e) => {
            e.preventDefault();
            const n = name.trim();
            if (!n) return;
            const id = createLabel(card.boardId, n, color);
            updateCard(card.id, { labelIds: [...card.labelIds, id] });
            setName("");
          }}
        >
          <input
            value={name}
            maxLength={30}
            placeholder="새 라벨 이름"
            aria-label="새 라벨 이름"
            className={`${field} min-w-0 flex-1 py-1`}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="flex gap-1" role="radiogroup" aria-label="라벨 색상">
            {LABEL_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={color === c.value}
                aria-label={c.name}
                title={c.name}
                className={`h-5 w-5 rounded-full ${c.dot} ${
                  color === c.value ? "ring-2 ring-offset-2 ring-zinc-500 dark:ring-offset-zinc-900" : ""
                }`}
                onClick={() => setColor(c.value)}
              />
            ))}
          </div>
          <button className="rounded-md bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700">추가</button>
        </form>
      )}
    </fieldset>
  );
}

// ---------------------------------------------------------------
// 체크리스트
// ---------------------------------------------------------------
export function ChecklistSection({ card }: { card: Card }) {
  const [text, setText] = useState("");
  const items = card.checklist;
  const done = items.filter((i) => i.done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const save = (checklist: Card["checklist"]) => updateCard(card.id, { checklist });

  return (
    <section className="space-y-2" aria-label="체크리스트">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-zinc-500">체크리스트</h3>
        {items.length > 0 && (
          <span className="text-xs text-zinc-500">
            {done}/{items.length} ({pct}%)
          </span>
        )}
      </div>
      {items.length > 0 && (
        <div
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700"
        >
          <div className="h-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id} className="group flex items-center gap-2">
            <input
              type="checkbox"
              checked={item.done}
              aria-label={`${item.text} 완료`}
              onChange={() => save(items.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)))}
            />
            <input
              key={item.text}
              defaultValue={item.text}
              maxLength={200}
              aria-label="체크리스트 항목"
              className={`min-w-0 flex-1 rounded bg-transparent px-1 py-0.5 text-sm outline-none focus:bg-zinc-100 dark:focus:bg-zinc-800 ${
                item.done ? "text-zinc-400 line-through" : ""
              }`}
              onBlur={(e) => {
                const t = e.target.value.trim();
                if (!t) save(items.filter((i) => i.id !== item.id));
                else if (t !== item.text) save(items.map((i) => (i.id === item.id ? { ...i, text: t } : i)));
              }}
            />
            <button
              type="button"
              aria-label={`${item.text} 삭제`}
              className="text-xs text-zinc-400 opacity-0 hover:text-red-600 focus:opacity-100 group-hover:opacity-100"
              onClick={() => save(items.filter((i) => i.id !== item.id))}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const t = text.trim();
          if (!t) return;
          save([...items, newChecklistItem(t)]);
          setText("");
        }}
      >
        <input
          value={text}
          maxLength={200}
          placeholder="+ 항목 추가 (Enter)"
          aria-label="체크리스트 항목 추가"
          className={`${field} py-1.5`}
          onChange={(e) => setText(e.target.value)}
        />
      </form>
    </section>
  );
}

// ---------------------------------------------------------------
// 댓글 (+ @멘션)
// ---------------------------------------------------------------
function CommentBody({ body, members }: { body: string; members: Member[] }) {
  // 본문은 항상 글자로만 보여준다. `@이름`은 실제 팀원 이름과 정확히 일치할 때만 강조한다.
  const parts = splitMentions(body, members.map((m) => m.name));
  return (
    <p className="whitespace-pre-wrap break-words text-sm">
      {parts.map((part, i) =>
        part.mention ? (
          <span key={i} className="rounded bg-blue-100 px-0.5 font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            {part.text}
          </span>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </p>
  );
}

const MAX_COMMENT_LENGTH = 5000;

export function CommentsSection({
  cardId,
  comments,
  members,
  me,
  isAdmin,
}: {
  cardId: string;
  comments: Comment[];
  members: Member[];
  me: string;
  isAdmin: boolean;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mention, setMention] = useState<string | null>(null); // 현재 입력 중인 @검색어
  const ref = useRef<HTMLTextAreaElement>(null);
  const byId = new Map(members.map((m) => [m.id, m]));

  const candidates = mention === null ? [] : members.filter((m) => m.name.includes(mention));

  function detectMention(value: string, caret: number) {
    const m = /(?:^|\s)@(\S*)$/.exec(value.slice(0, caret));
    setMention(m ? m[1] : null);
  }

  function pick(member: Member) {
    const el = ref.current;
    if (!el) return;
    const caret = el.selectionStart;
    const before = text.slice(0, caret).replace(/@(\S*)$/, `@${member.name} `);
    const next = before + text.slice(caret);
    if (next.length > MAX_COMMENT_LENGTH) {
      setMention(null);
      setError(`댓글은 ${MAX_COMMENT_LENGTH.toLocaleString("ko-KR")}자까지 쓸 수 있습니다.`);
      return;
    }
    setText(next);
    setMention(null);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(before.length, before.length);
    });
  }

  function submit() {
    const body = text.trim();
    if (!body) return;
    if (body.length > MAX_COMMENT_LENGTH) {
      setError(`댓글은 ${MAX_COMMENT_LENGTH.toLocaleString("ko-KR")}자까지 쓸 수 있습니다. 내용은 그대로 두었으니 줄여서 다시 등록해 주세요.`);
      return;
    }
    addComment(cardId, body);
    setText("");
    setMention(null);
    setError(null);
  }

  return (
    <section className="space-y-3" aria-label="댓글">
      <h3 className="text-xs font-medium text-zinc-500">댓글 {comments.length > 0 && `(${comments.length})`}</h3>

      <ul className="space-y-3">
        {comments.map((c) => {
          const author = byId.get(c.userId);
          return (
            <li key={c.id} className="flex gap-2">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100">
                {initials(author?.name ?? "?")}
              </span>
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">{author?.name ?? "알 수 없음"}</span>
                  <time dateTime={c.createdAt}>{relativeTime(c.createdAt)}</time>
                  {(c.userId === me || isAdmin) && (
                    <button
                      type="button"
                      className="ml-auto hover:text-red-600"
                      onClick={() => {
                        if (window.confirm("이 댓글을 삭제할까요?")) deleteComment(c.id);
                      }}
                    >
                      삭제
                    </button>
                  )}
                </div>
                <CommentBody body={c.body} members={members} />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="relative">
        <textarea
          ref={ref}
          value={text}
          rows={2}
          maxLength={5000}
          placeholder="댓글 입력 — @로 팀원 멘션, Ctrl+Enter로 등록"
          aria-label="댓글 입력"
          className={field}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
            detectMention(e.target.value, e.target.selectionStart);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              submit();
            } else if (e.key === "Escape" && mention !== null) {
              e.stopPropagation(); // 다이얼로그가 닫히지 않게
              setMention(null);
            }
          }}
        />
        {candidates.length > 0 && (
          <ul
            role="listbox"
            aria-label="멘션할 팀원"
            className="absolute bottom-full left-0 z-10 mb-1 w-48 overflow-hidden rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
          >
            {candidates.map((m) => (
              <li key={m.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  onMouseDown={(e) => e.preventDefault()} // 포커스 유지
                  onClick={() => pick(m)}
                >
                  @{m.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <button
          type="button"
          disabled={!text.trim()}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-40"
          onClick={submit}
        >
          댓글 등록
        </button>
      </div>
    </section>
  );
}
