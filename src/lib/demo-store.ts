import { generateKeyBetween } from "fractional-indexing";
import { useSyncExternalStore } from "react";
import { isSupabaseConfigured } from "./supabase/env";
import type {
  Activity,
  ActivityAction,
  AppState,
  Card,
  ChecklistItem,
  Column,
  Label,
  LabelColor,
  NotificationPrefs,
  Priority,
} from "./types";

/**
 * 클라이언트 상태 저장소.
 * - 데모 모드(Supabase 환경변수 없음): localStorage에 저장
 * - Supabase 모드: 메모리 상태를 낙관적으로 갱신하고, 변경분을 sync/supabase-sync.ts가 DB에 반영.
 *   Realtime 이벤트로 서버 상태를 다시 받아 replaceState로 교체한다.
 */

/** 상태 변경을 외부(DB)에 반영하는 백엔드 */
export interface StoreBackend {
  onCommit(prev: AppState, next: AppState): void;
}
let backend: StoreBackend | null = null;

export function attachBackend(b: StoreBackend) {
  backend = b;
}

const STORAGE_KEY = "kanban-demo-v3";
const MAX_ACTIVITY = 300;
const DEFAULT_COLUMNS = ["Backlog", "To Do", "In Progress", "Review", "Done"];
const DEFAULT_LABELS: [string, LabelColor][] = [
  ["디자인", "violet"],
  ["개발", "blue"],
  ["버그", "red"],
  ["문서", "green"],
];

const uid = () => crypto.randomUUID();

function positions(count: number): string[] {
  const keys: string[] = [];
  let prev: string | null = null;
  for (let i = 0; i < count; i++) {
    prev = generateKeyBetween(prev, null);
    keys.push(prev);
  }
  return keys;
}

function seedActivity(cards: Card[], columns: Column[]): Activity[] {
  const hour = 1000 * 60 * 60;
  const makers = ["m-1", "m-2", "m-3", "m-me", "m-1"];
  const entries: Activity[] = [];
  cards.forEach((card, i) => {
    const colName = columns.find((c) => c.id === card.columnId)?.name ?? "";
    entries.push({
      id: uid(),
      boardId: card.boardId,
      cardId: card.id,
      cardTitle: card.title,
      userId: makers[i % makers.length],
      action: "card_created",
      detail: "Backlog",
      createdAt: new Date(Date.now() - (30 - i * 4) * hour).toISOString(),
    });
    if (colName !== "Backlog") {
      entries.push({
        id: uid(),
        boardId: card.boardId,
        cardId: card.id,
        cardTitle: card.title,
        userId: makers[(i + 1) % makers.length],
        action: "card_moved",
        detail: `Backlog → ${colName}`,
        createdAt: new Date(Date.now() - (24 - i * 4) * hour).toISOString(),
      });
    }
  });
  return entries.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

function seed(): AppState {
  const members = [
    { id: "m-me", name: "나" },
    { id: "m-1", name: "김민수" },
    { id: "m-2", name: "이서연" },
    { id: "m-3", name: "박지훈" },
  ];
  const boardId = uid();
  const colPos = positions(DEFAULT_COLUMNS.length);
  const columns: Column[] = DEFAULT_COLUMNS.map((name, i) => ({
    id: uid(),
    boardId,
    name,
    position: colPos[i],
    wipLimit: name === "In Progress" ? 3 : null,
  }));
  const col = (name: string) => columns.find((c) => c.name === name)!.id;
  const labels: Label[] = DEFAULT_LABELS.map(([name, color]) => ({ id: uid(), boardId, name, color }));
  const label = (name: string) => labels.find((l) => l.name === name)!.id;

  const samples: [string, string, Priority, string[], string[]][] = [
    ["로그인 화면 디자인", "Backlog", "medium", ["m-1"], ["디자인"]],
    ["요구사항 정리", "Done", "high", ["m-me"], ["문서"]],
    ["DB 스키마 설계", "Review", "high", ["m-2", "m-me"], ["개발", "문서"]],
    ["드래그앤드롭 구현", "In Progress", "urgent", ["m-me"], ["개발"]],
    ["알림 메일 템플릿", "To Do", "low", ["m-3"], ["디자인"]],
  ];
  const perColumn = new Map<string, string | null>();
  const cards: Card[] = samples.map(([title, colName, priority, assigneeIds, labelNames]) => {
    const columnId = col(colName);
    const position = generateKeyBetween(perColumn.get(columnId) ?? null, null);
    perColumn.set(columnId, position);
    return {
      id: uid(),
      boardId,
      columnId,
      title,
      description: "",
      position,
      priority,
      dueDate: null,
      assigneeIds,
      labelIds: labelNames.map(label),
      checklist:
        title === "드래그앤드롭 구현"
          ? [
              { id: uid(), text: "카드 이동", done: true },
              { id: uid(), text: "컬럼 이동", done: true },
              { id: uid(), text: "키보드 접근성", done: false },
            ]
          : [],
      createdAt: new Date().toISOString(),
    };
  });
  const dragCard = cards.find((c) => c.title === "드래그앤드롭 구현")!;

  return {
    me: "m-me",
    isAdmin: true,
    members,
    boards: [{ id: boardId, name: "팀 보드", archived: false }],
    columns,
    labels,
    cards,
    activity: seedActivity(cards, columns),
    notifications: [
      {
        id: uid(),
        userId: "m-me",
        type: "mention",
        boardId,
        cardId: dragCard.id,
        cardTitle: dragCard.title,
        actorId: "m-1",
        read: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      },
      {
        id: uid(),
        userId: "m-me",
        type: "assigned",
        boardId,
        cardId: cards.find((c) => c.title === "DB 스키마 설계")!.id,
        cardTitle: "DB 스키마 설계",
        actorId: "m-2",
        read: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      },
    ],
    prefs: { emailMention: true, emailAssigned: true, emailDue: true },
    comments: [
      {
        id: uid(),
        cardId: dragCard.id,
        userId: "m-1",
        body: "@나 컬럼 순서 변경도 같이 확인 부탁해요!",
        createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      },
    ],
  };
}

// ---------------------------------------------------------------
// 외부 스토어 (useSyncExternalStore)
// ---------------------------------------------------------------
let state: AppState | null = null;
const listeners = new Set<() => void>();

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      // 이전 버전에 저장된 데이터에 없는 필드를 기본값으로 보완
      const saved = JSON.parse(raw) as Partial<AppState>;
      const base = seed();
      return {
        ...(saved as AppState),
        isAdmin: saved.isAdmin ?? true,
        activity: saved.activity ?? [],
        notifications: saved.notifications ?? [],
        prefs: saved.prefs ?? base.prefs,
      };
    }
  } catch {
    // 저장소 접근 불가/손상 시 시드 데이터로 시작
  }
  // 최초 방문: 시드를 즉시 저장해 새로고침해도 ID가 유지되게 함
  const initial = seed();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  } catch {
    // 저장 불가 환경에서는 메모리에서만 유지
  }
  return initial;
}

function getSnapshot(): AppState | null {
  // Supabase 모드: 서버에서 불러오기 전까지 null (로딩 중)
  if (isSupabaseConfigured) return state;
  if (!state) state = load();
  return state;
}

/** 로드가 끝난 뒤에만 호출되는 액션용 */
function cur(): AppState {
  const s = getSnapshot();
  if (!s) throw new Error("상태가 아직 로드되지 않았습니다");
  return s;
}

/** 서버에서 받은 상태로 교체 (DB에 다시 쓰지 않음) */
export function replaceState(next: AppState) {
  state = next;
  listeners.forEach((l) => l());
}

export function getState(): AppState | null {
  return state;
}

function getServerSnapshot(): AppState | null {
  return null;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (isSupabaseConfigured && typeof window !== "undefined") {
    // 첫 구독 시 서버 동기화 시작 (여러 번 호출돼도 한 번만 시작됨)
    void import("./sync/supabase-sync").then((m) => m.startSync());
  }
  return () => {
    listeners.delete(listener);
  };
}

function commit(next: AppState) {
  const prev = state;
  state = next;
  if (isSupabaseConfigured) {
    if (backend && prev) backend.onCommit(prev, next);
  } else {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // 용량 초과 등은 무시 (메모리 상태는 유지)
    }
  }
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined" && !isSupabaseConfigured) {
  // 다른 탭에서의 변경 반영
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY) return;
    state = null;
    listeners.forEach((l) => l());
  });
}

/** 서버/하이드레이션 중에는 null */
export function useAppState(): AppState | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// ---------------------------------------------------------------
// 조회 헬퍼
// ---------------------------------------------------------------
const byPosition = <T extends { position: string }>(a: T, b: T) =>
  a.position < b.position ? -1 : a.position > b.position ? 1 : 0;

export const boardColumns = (s: AppState, boardId: string) =>
  s.columns.filter((c) => c.boardId === boardId).sort(byPosition);

export const columnCards = (s: AppState, columnId: string) =>
  s.cards.filter((c) => c.columnId === columnId).sort(byPosition);

// ---------------------------------------------------------------
// 액션
// ---------------------------------------------------------------
const update = (fn: (s: AppState) => AppState) => {
  const s = getSnapshot();
  if (s) commit(fn(s));
};

interface LogInput {
  boardId: string;
  cardId: string;
  cardTitle: string;
  action: ActivityAction;
  detail?: string | null;
  userId?: string;
  id?: string;
}

/** 활동 기록을 맨 앞에 추가 (최신순, 최대 MAX_ACTIVITY개) */
function log(s: AppState, a: LogInput): AppState {
  // Supabase 모드: 활동 기록은 DB 트리거가 만들고 서버에서 받아온다
  if (isSupabaseConfigured) return s;
  const entry: Activity = {
    id: a.id ?? uid(),
    boardId: a.boardId,
    cardId: a.cardId,
    cardTitle: a.cardTitle,
    userId: a.userId ?? s.me,
    action: a.action,
    detail: a.detail ?? null,
    createdAt: new Date().toISOString(),
  };
  return { ...s, activity: [entry, ...s.activity].slice(0, MAX_ACTIVITY) };
}

const noop = () => {};

export function createBoard(name: string): string {
  const id = uid();
  const colPos = positions(DEFAULT_COLUMNS.length);
  update((s) => ({
    ...s,
    boards: [...s.boards, { id, name, archived: false }],
    labels: [
      ...s.labels,
      ...DEFAULT_LABELS.map(([n, color]) => ({ id: uid(), boardId: id, name: n, color })),
    ],
    columns: [
      ...s.columns,
      ...DEFAULT_COLUMNS.map((n, i) => ({
        id: uid(),
        boardId: id,
        name: n,
        position: colPos[i],
        wipLimit: null,
      })),
    ],
  }));
  return id;
}

export function renameBoard(id: string, name: string) {
  update((s) => ({ ...s, boards: s.boards.map((b) => (b.id === id ? { ...b, name } : b)) }));
}

/** 실행 취소 함수를 반환 */
export function deleteBoard(id: string): () => void {
  const s0 = cur();
  const board = s0.boards.find((b) => b.id === id);
  if (!board) return noop;
  const removed = {
    columns: s0.columns.filter((c) => c.boardId === id),
    labels: s0.labels.filter((l) => l.boardId === id),
    cards: s0.cards.filter((c) => c.boardId === id),
    activity: s0.activity.filter((a) => a.boardId === id),
    notifications: s0.notifications.filter((n) => n.boardId === id),
  };
  const cardIds = new Set(removed.cards.map((c) => c.id));
  const comments = s0.comments.filter((cm) => cardIds.has(cm.cardId));
  update((s) => ({
    ...s,
    boards: s.boards.filter((b) => b.id !== id),
    columns: s.columns.filter((c) => c.boardId !== id),
    labels: s.labels.filter((l) => l.boardId !== id),
    cards: s.cards.filter((c) => c.boardId !== id),
    comments: s.comments.filter((cm) => !cardIds.has(cm.cardId)),
    activity: s.activity.filter((a) => a.boardId !== id),
    notifications: s.notifications.filter((n) => n.boardId !== id),
  }));
  return () =>
    update((s) =>
      s.boards.some((b) => b.id === id)
        ? s
        : {
            ...s,
            boards: [...s.boards, board],
            columns: [...s.columns, ...removed.columns],
            labels: [...s.labels, ...removed.labels],
            cards: [...s.cards, ...removed.cards],
            comments: [...s.comments, ...comments],
            activity: [...s.activity, ...removed.activity].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
            notifications: [...s.notifications, ...removed.notifications],
          },
    );
}

export function addColumn(boardId: string, name: string) {
  update((s) => {
    const cols = boardColumns(s, boardId);
    const position = generateKeyBetween(cols.at(-1)?.position ?? null, null);
    return {
      ...s,
      columns: [...s.columns, { id: uid(), boardId, name, position, wipLimit: null }],
    };
  });
}

export function updateColumn(id: string, patch: Partial<Pick<Column, "name" | "wipLimit">>) {
  update((s) => ({ ...s, columns: s.columns.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
}

/** 실행 취소 함수를 반환 */
export function deleteColumn(id: string): () => void {
  const s0 = cur();
  const column = s0.columns.find((c) => c.id === id);
  if (!column) return noop;
  const cards = s0.cards.filter((c) => c.columnId === id);
  const cardIds = new Set(cards.map((c) => c.id));
  const comments = s0.comments.filter((cm) => cardIds.has(cm.cardId));
  update((s) => ({
    ...s,
    columns: s.columns.filter((c) => c.id !== id),
    cards: s.cards.filter((c) => c.columnId !== id),
    comments: s.comments.filter((cm) => !cardIds.has(cm.cardId)),
  }));
  return () =>
    update((s) =>
      s.columns.some((c) => c.id === id) || !s.boards.some((b) => b.id === column.boardId)
        ? s
        : { ...s, columns: [...s.columns, column], cards: [...s.cards, ...cards], comments: [...s.comments, ...comments] },
    );
}

/** toIndex: 이동 대상 컬럼 제외 후의 목표 인덱스 */
export function moveColumn(id: string, toIndex: number) {
  update((s) => {
    const col = s.columns.find((c) => c.id === id);
    if (!col) return s;
    const others = boardColumns(s, col.boardId).filter((c) => c.id !== id);
    const position = generateKeyBetween(
      others[toIndex - 1]?.position ?? null,
      others[toIndex]?.position ?? null,
    );
    return { ...s, columns: s.columns.map((c) => (c.id === id ? { ...c, position } : c)) };
  });
}

export function addCard(columnId: string, title: string) {
  update((s) => {
    const col = s.columns.find((c) => c.id === columnId);
    if (!col) return s;
    const last = columnCards(s, columnId).at(-1);
    const card: Card = {
      id: uid(),
      boardId: col.boardId,
      columnId,
      title,
      description: "",
      position: generateKeyBetween(last?.position ?? null, null),
      priority: "medium",
      dueDate: null,
      assigneeIds: [],
      labelIds: [],
      checklist: [],
      createdAt: new Date().toISOString(),
    };
    return log(
      { ...s, cards: [...s.cards, card] },
      { boardId: col.boardId, cardId: card.id, cardTitle: title, action: "card_created", detail: col.name },
    );
  });
}

export function updateCard(
  id: string,
  patch: Partial<
    Pick<Card, "title" | "description" | "priority" | "dueDate" | "assigneeIds" | "labelIds" | "checklist">
  >,
) {
  update((s) => {
    const prev = s.cards.find((c) => c.id === id);
    if (!prev) return s;
    let next: AppState = { ...s, cards: s.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)) };
    if (patch.assigneeIds) {
      for (const userId of patch.assigneeIds.filter((u) => !prev.assigneeIds.includes(u))) {
        next = log(next, {
          boardId: prev.boardId,
          cardId: id,
          cardTitle: patch.title ?? prev.title,
          action: "assigned",
          detail: s.members.find((m) => m.id === userId)?.name ?? "",
        });
      }
    }
    return next;
  });
}

/** 실행 취소 함수를 반환 */
export function deleteCard(id: string): () => void {
  const s0 = cur();
  const card = s0.cards.find((c) => c.id === id);
  if (!card) return noop;
  const comments = s0.comments.filter((cm) => cm.cardId === id);
  const actId = uid();
  update((s) =>
    log(
      { ...s, cards: s.cards.filter((c) => c.id !== id), comments: s.comments.filter((cm) => cm.cardId !== id) },
      { id: actId, boardId: card.boardId, cardId: id, cardTitle: card.title, action: "card_deleted" },
    ),
  );
  return () =>
    update((s) =>
      s.cards.some((c) => c.id === id) || !s.columns.some((c) => c.id === card.columnId)
        ? s
        : {
            ...s,
            cards: [...s.cards, card],
            comments: [...s.comments, ...comments],
            activity: s.activity.filter((a) => a.id !== actId),
          },
    );
}

// ---- 라벨 ----
export function createLabel(boardId: string, name: string, color: LabelColor): string {
  const id = uid();
  update((s) => ({ ...s, labels: [...s.labels, { id, boardId, name, color }] }));
  return id;
}

export function deleteLabel(id: string) {
  update((s) => ({
    ...s,
    labels: s.labels.filter((l) => l.id !== id),
    cards: s.cards.map((c) =>
      c.labelIds.includes(id) ? { ...c, labelIds: c.labelIds.filter((l) => l !== id) } : c,
    ),
  }));
}

// ---- 체크리스트 (카드 단위로 통째로 갱신) ----
export const newChecklistItem = (text: string): ChecklistItem => ({ id: uid(), text, done: false });

// ---- 댓글 ----
export function addComment(cardId: string, body: string) {
  update((s) => {
    const card = s.cards.find((c) => c.id === cardId);
    if (!card) return s;
    return log(
      {
        ...s,
        comments: [...s.comments, { id: uid(), cardId, userId: s.me, body, createdAt: new Date().toISOString() }],
      },
      {
        boardId: card.boardId,
        cardId,
        cardTitle: card.title,
        action: "comment_added",
        detail: body.length > 40 ? `${body.slice(0, 40)}…` : body,
      },
    );
  });
}

export function deleteComment(id: string) {
  update((s) => ({ ...s, comments: s.comments.filter((c) => c.id !== id) }));
}

/** toIndex: 이동한 카드를 제외한 대상 컬럼 목록 기준 인덱스 */
export function moveCard(id: string, toColumnId: string, toIndex: number) {
  update((s) => {
    const card = s.cards.find((c) => c.id === id);
    if (!card) return s;
    const others = columnCards(s, toColumnId).filter((c) => c.id !== id);
    const position = generateKeyBetween(
      others[toIndex - 1]?.position ?? null,
      others[toIndex]?.position ?? null,
    );
    const next: AppState = {
      ...s,
      cards: s.cards.map((c) => (c.id === id ? { ...c, columnId: toColumnId, position } : c)),
    };
    if (card.columnId === toColumnId) return next;
    const from = s.columns.find((c) => c.id === card.columnId)?.name ?? "";
    const to = s.columns.find((c) => c.id === toColumnId)?.name ?? "";
    return log(next, {
      boardId: card.boardId,
      cardId: id,
      cardTitle: card.title,
      action: "card_moved",
      detail: `${from} → ${to}`,
    });
  });
}

// ---- 알림 ----
export function markNotificationRead(id: string) {
  update((s) => ({
    ...s,
    notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
  }));
}

export function markAllNotificationsRead() {
  update((s) => ({ ...s, notifications: s.notifications.map((n) => ({ ...n, read: true })) }));
}

export function setPref(key: keyof NotificationPrefs, value: boolean) {
  update((s) => ({ ...s, prefs: { ...s.prefs, [key]: value } }));
}

/** 마감이 오늘/내일인 내 카드(완료 컬럼 제외)에 대해 마감 임박 알림을 한 번씩 생성 */
export function refreshDueSoon() {
  if (isSupabaseConfigured) return; // 마감 임박 알림은 서버(M5)에서 생성
  const s0 = cur();
  const today = new Date().toLocaleDateString("sv");
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString("sv");
  const targets = s0.cards.filter(
    (c) =>
      c.assigneeIds.includes(s0.me) &&
      c.dueDate !== null &&
      c.dueDate >= today &&
      c.dueDate <= tomorrow &&
      boardColumns(s0, c.boardId).at(-1)?.id !== c.columnId &&
      !s0.notifications.some((n) => n.type === "due_soon" && n.cardId === c.id),
  );
  if (targets.length === 0) return; // 변경이 없으면 커밋하지 않음 (무한 갱신 방지)
  update((s) => ({
    ...s,
    notifications: [
      ...targets.map((c) => ({
        id: uid(),
        userId: s.me,
        type: "due_soon" as const,
        boardId: c.boardId,
        cardId: c.id,
        cardTitle: c.title,
        actorId: null,
        read: false,
        createdAt: new Date().toISOString(),
      })),
      ...s.notifications,
    ],
  }));
}

/** 데모용: 동료가 나를 담당자로 지정하거나 멘션한 것처럼 알림을 만든다 */
export function simulateNotification() {
  if (isSupabaseConfigured) return; // 데모 전용
  const s0 = cur();
  const others = s0.members.filter((m) => m.id !== s0.me);
  if (others.length === 0 || s0.cards.length === 0) return;
  const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];
  const actor = pick(others);
  const card = pick(s0.cards);
  const type = pick(["assigned", "mention"] as const);

  update((s) => {
    let next: AppState = {
      ...s,
      notifications: [
        {
          id: uid(),
          userId: s.me,
          type,
          boardId: card.boardId,
          cardId: card.id,
          cardTitle: card.title,
          actorId: actor.id,
          read: false,
          createdAt: new Date().toISOString(),
        },
        ...s.notifications,
      ],
    };
    const base = { boardId: card.boardId, cardId: card.id, cardTitle: card.title, userId: actor.id };
    if (type === "assigned") {
      next = {
        ...next,
        cards: next.cards.map((c) =>
          c.id === card.id && !c.assigneeIds.includes(s.me) ? { ...c, assigneeIds: [...c.assigneeIds, s.me] } : c,
        ),
      };
      next = log(next, { ...base, action: "assigned", detail: s.members.find((m) => m.id === s.me)?.name });
    } else {
      const body = "@나 확인 부탁드려요!";
      next = {
        ...next,
        comments: [
          ...next.comments,
          { id: uid(), cardId: card.id, userId: actor.id, body, createdAt: new Date().toISOString() },
        ],
      };
      next = log(next, { ...base, action: "comment_added", detail: body });
    }
    return next;
  });
}
