import { generateKeyBetween } from "fractional-indexing";
import { createClient } from "@/lib/supabase/client";
import { attachBackend, replaceState } from "../demo-store";
import type {
  Activity,
  ActivityAction,
  AppState,
  Card,
  LabelColor,
  Notification,
  NotificationType,
  Priority,
} from "../types";

/**
 * Supabase 동기화.
 * - 로드: RLS가 허용하는 모든 데이터를 병렬로 읽어 AppState로 조립한다.
 * - 쓰기: 스토어 상태가 바뀔 때마다 이전/현재를 비교해 변경분만 DB에 반영한다 (낙관적 UI).
 * - 실시간: postgres_changes 이벤트를 받으면 서버 상태를 다시 읽어 교체한다.
 *   내 쓰기가 진행 중일 때는 교체를 미뤄 낙관적 상태가 되돌려지지 않게 한다.
 */

// ---------------------------------------------------------------
// DB 행 타입
// ---------------------------------------------------------------
interface ProfileRow { id: string; name: string; role: "admin" | "member" }
interface BoardRow { id: string; name: string; archived: boolean }
interface ColumnRow { id: string; board_id: string; name: string; position: string; wip_limit: number | null }
interface LabelRow { id: string; board_id: string; name: string; color: LabelColor }
interface CardRow {
  id: string;
  board_id: string;
  column_id: string;
  title: string;
  description: string;
  position: string;
  priority: Priority;
  due_date: string | null;
  created_at: string;
}
interface AssigneeRow { card_id: string; user_id: string }
interface CardLabelRow { card_id: string; label_id: string }
interface ChecklistRow { id: string; card_id: string; text: string; done: boolean; position: string }
interface CommentRow { id: string; card_id: string; user_id: string; body: string; created_at: string }
interface ActivityRow {
  id: number;
  board_id: string | null;
  card_id: string | null;
  user_id: string | null;
  action: string;
  payload: Record<string, unknown> | null;
  created_at: string;
}
interface NotificationRow {
  id: string;
  user_id: string;
  type: NotificationType;
  card_id: string | null;
  actor_id: string | null;
  read: boolean;
  created_at: string;
}
interface PrefsRow { user_id: string; email_mention: boolean; email_assigned: boolean; email_due: boolean }

const REALTIME_TABLES = [
  "profiles",
  "boards",
  "columns",
  "labels",
  "cards",
  "card_assignees",
  "card_labels",
  "checklist_items",
  "comments",
  "notifications",
] as const;

const supabase = createClient();

// ---------------------------------------------------------------
// 로드
// ---------------------------------------------------------------
function rows<T>(res: { data: unknown[] | null; error: { message: string } | null }, table: string): T[] {
  if (res.error) throw new Error(`${table}: ${res.error.message}`);
  return (res.data ?? []) as T[];
}

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

const byPos = <T extends { position: string }>(a: T, b: T) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0);

async function fetchAll(): Promise<AppState> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("NOT_AUTHENTICATED");
  const me = user.id;

  const [pr, bo, co, la, ca, as, cl, ck, cm, ac, no, pf] = await Promise.all([
    supabase.from("profiles").select("id, name, role"),
    supabase.from("boards").select("id, name, archived"),
    supabase.from("columns").select("id, board_id, name, position, wip_limit"),
    supabase.from("labels").select("id, board_id, name, color"),
    supabase
      .from("cards")
      .select("id, board_id, column_id, title, description, position, priority, due_date, created_at")
      .is("deleted_at", null),
    supabase.from("card_assignees").select("card_id, user_id"),
    supabase.from("card_labels").select("card_id, label_id"),
    supabase.from("checklist_items").select("id, card_id, text, done, position"),
    supabase.from("comments").select("id, card_id, user_id, body, created_at").order("created_at"),
    supabase
      .from("activity_log")
      .select("id, board_id, card_id, user_id, action, payload, created_at")
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("notifications")
      .select("id, user_id, type, card_id, actor_id, read, created_at")
      .eq("user_id", me)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("notification_prefs").select("user_id, email_mention, email_assigned, email_due").eq("user_id", me),
  ]);

  const profiles = rows<ProfileRow>(pr, "profiles");
  const boardRows = rows<BoardRow>(bo, "boards");
  const columnRows = rows<ColumnRow>(co, "columns");
  const labelRows = rows<LabelRow>(la, "labels");
  const cardRows = rows<CardRow>(ca, "cards");
  const assigneeRows = rows<AssigneeRow>(as, "card_assignees");
  const cardLabelRows = rows<CardLabelRow>(cl, "card_labels");
  const checklistRows = rows<ChecklistRow>(ck, "checklist_items");
  const commentRows = rows<CommentRow>(cm, "comments");
  const activityRows = rows<ActivityRow>(ac, "activity_log");
  const notificationRows = rows<NotificationRow>(no, "notifications");
  const prefsRow = rows<PrefsRow>(pf, "notification_prefs")[0];

  const assigneesByCard = groupBy(assigneeRows, (r) => r.card_id);
  const labelsByCard = groupBy(cardLabelRows, (r) => r.card_id);
  const checklistByCard = groupBy(checklistRows, (r) => r.card_id);

  const cards: Card[] = cardRows.map((c) => ({
    id: c.id,
    boardId: c.board_id,
    columnId: c.column_id,
    title: c.title,
    description: c.description,
    position: c.position,
    priority: c.priority,
    dueDate: c.due_date,
    assigneeIds: (assigneesByCard.get(c.id) ?? []).map((r) => r.user_id),
    labelIds: (labelsByCard.get(c.id) ?? []).map((r) => r.label_id),
    checklist: (checklistByCard.get(c.id) ?? [])
      .sort(byPos)
      .map((r) => ({ id: r.id, text: r.text, done: r.done })),
    createdAt: c.created_at,
  }));

  const cardById = new Map(cards.map((c) => [c.id, c]));
  const columnName = new Map(columnRows.map((c) => [c.id, c.name]));
  const memberName = new Map(profiles.map((p) => [p.id, p.name]));
  const commentBody = new Map(commentRows.map((c) => [c.id, c.body]));
  const preview = (t: string) => (t.length > 40 ? `${t.slice(0, 40)}…` : t);

  const activity: Activity[] = [];
  for (const a of activityRows) {
    const card = a.card_id ? cardById.get(a.card_id) : undefined;
    // 삭제된 카드의 기록은 card_id 가 비어 있으므로 payload 의 제목을 사용한다
    if (!a.board_id || !a.user_id || (!card && a.action !== "card_deleted")) continue;
    const payload = a.payload ?? {};
    let detail: string | null = null;
    switch (a.action) {
      case "card_created":
        detail = columnName.get(String(payload.column_id)) ?? null;
        break;
      case "card_moved":
        detail = `${columnName.get(String(payload.from)) ?? ""} → ${columnName.get(String(payload.to)) ?? ""}`;
        break;
      case "assigned":
        detail = memberName.get(String(payload.assignee)) ?? null;
        break;
      case "comment_added": {
        const body = commentBody.get(String(payload.comment_id));
        detail = body ? preview(body) : null;
        break;
      }
    }
    activity.push({
      id: String(a.id),
      boardId: a.board_id,
      cardId: card?.id ?? `deleted:${a.id}`,
      cardTitle: card?.title ?? String(payload.title ?? ""),
      userId: a.user_id,
      action: a.action as ActivityAction,
      detail,
      createdAt: a.created_at,
    });
  }

  const notifications: Notification[] = [];
  for (const n of notificationRows) {
    const card = n.card_id ? cardById.get(n.card_id) : undefined;
    if (!card) continue;
    notifications.push({
      id: n.id,
      userId: n.user_id,
      type: n.type,
      boardId: card.boardId,
      cardId: card.id,
      cardTitle: card.title,
      actorId: n.actor_id,
      read: n.read,
      createdAt: n.created_at,
    });
  }

  return {
    me,
    isAdmin: profiles.find((p) => p.id === me)?.role === "admin",
    members: profiles.map((p) => ({ id: p.id, name: p.name })),
    boards: boardRows,
    columns: columnRows.map((c) => ({
      id: c.id,
      boardId: c.board_id,
      name: c.name,
      position: c.position,
      wipLimit: c.wip_limit,
    })),
    labels: labelRows.map((l) => ({ id: l.id, boardId: l.board_id, name: l.name, color: l.color })),
    cards,
    comments: commentRows.map((c) => ({
      id: c.id,
      cardId: c.card_id,
      userId: c.user_id,
      body: c.body,
      createdAt: c.created_at,
    })),
    activity,
    notifications,
    prefs: {
      emailMention: prefsRow?.email_mention ?? true,
      emailAssigned: prefsRow?.email_assigned ?? true,
      emailDue: prefsRow?.email_due ?? true,
    },
  };
}

// ---------------------------------------------------------------
// 쓰기 (이전/현재 상태 비교)
// ---------------------------------------------------------------
type Result = { error: { message: string } | null };
type Write = () => PromiseLike<Result>;

function diffById<T extends { id: string }>(prev: T[], next: T[]) {
  const prevMap = new Map(prev.map((x) => [x.id, x]));
  const nextIds = new Set(next.map((x) => x.id));
  return {
    upserts: next.filter((x) => prevMap.get(x.id) !== x),
    removed: prev.filter((x) => !nextIds.has(x.id)),
    prevMap,
  };
}

const ids = (list: { id: string }[]) => list.map((x) => x.id);

function sequentialKeys(n: number): string[] {
  const keys: string[] = [];
  let prev: string | null = null;
  for (let i = 0; i < n; i++) {
    prev = generateKeyBetween(prev, null);
    keys.push(prev);
  }
  return keys;
}

interface Diff<T> {
  upserts: T[];
  removed: T[];
  prevMap: Map<string, T>;
}

/** 이전 행과 비교해 바뀐 칸만 골라낸다 (다른 사람의 동시 수정을 덮어쓰지 않기 위해) */
function diffFields<T>(old: T, cur: T, fields: [string, (t: T) => unknown][]): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const [col, get] of fields) if (get(old) !== get(cur)) patch[col] = get(cur);
  return patch;
}

/** 새 행은 전체를 저장하고, 기존 행은 바뀐 칸만 수정한다 */
function planUpserts<T extends { id: string }>(
  table: string,
  d: Diff<T>,
  full: (x: T) => Record<string, unknown>,
  changed: (old: T, x: T) => Record<string, unknown>,
  out: Write[],
) {
  const created = d.upserts.filter((x) => !d.prevMap.has(x.id));
  if (created.length) out.push(() => supabase.from(table).upsert(created.map(full)));
  for (const x of d.upserts) {
    const old = d.prevMap.get(x.id);
    if (!old) continue;
    const patch = changed(old, x);
    if (Object.keys(patch).length) out.push(() => supabase.from(table).update(patch).eq("id", x.id));
  }
}

/** 지운 행 수가 요청한 수보다 적으면(권한 없음 등) 오류로 처리한다 */
function strictDelete(table: string, idList: string[]): Write {
  return async () => {
    const { data, error } = await supabase.from(table).delete().in("id", idList).select("id");
    if (error) return { error };
    if ((data?.length ?? 0) < idList.length)
      return { error: { message: `${table}: 일부 행을 지우지 못했습니다 (권한이 없거나 이미 삭제됨)` } };
    return { error: null };
  };
}

/** 카드는 행을 지우지 않고 deleted_at 만 표시한다 (다른 멤버의 댓글이 연쇄 삭제되지 않게) */
function softDeleteCards(idList: string[]): Write {
  return async () => {
    const { data, error } = await supabase
      .from("cards")
      .update({ deleted_at: new Date().toISOString() })
      .in("id", idList)
      .select("id");
    if (error) return { error };
    if ((data?.length ?? 0) < idList.length)
      return { error: { message: "cards: 일부 카드를 삭제하지 못했습니다 (권한이 없거나 이미 삭제됨)" } };
    return { error: null };
  };
}

/** 이전/현재 상태를 비교해 DB 에 보낼 쓰기 목록을 만든다 (시험을 위해 내보냄) */
export function planWrites(prev: AppState, next: AppState): { upserts: Write[]; deletes: Write[] } {
  const upserts: Write[] = [];
  const deletes: Write[] = [];

  // boards
  const b = diffById(prev.boards, next.boards);
  planUpserts(
    "boards",
    b,
    (x) => ({ id: x.id, name: x.name, archived: x.archived }),
    (o, x) => diffFields(o, x, [["name", (t) => t.name], ["archived", (t) => t.archived]]),
    upserts,
  );
  if (b.removed.length) deletes.push(strictDelete("boards", ids(b.removed)));

  // labels
  const l = diffById(prev.labels, next.labels);
  planUpserts(
    "labels",
    l,
    (x) => ({ id: x.id, board_id: x.boardId, name: x.name, color: x.color }),
    (o, x) => diffFields(o, x, [["name", (t) => t.name], ["color", (t) => t.color]]),
    upserts,
  );
  if (l.removed.length) deletes.push(strictDelete("labels", ids(l.removed)));

  // columns
  const c = diffById(prev.columns, next.columns);
  planUpserts(
    "columns",
    c,
    (x) => ({ id: x.id, board_id: x.boardId, name: x.name, position: x.position, wip_limit: x.wipLimit }),
    (o, x) =>
      diffFields(o, x, [
        ["name", (t) => t.name],
        ["position", (t) => t.position],
        ["wip_limit", (t) => t.wipLimit],
      ]),
    upserts,
  );
  if (c.removed.length) deletes.push(strictDelete("columns", ids(c.removed)));
  const removedColumnIds = new Set(ids(c.removed));
  const removedBoardIds = new Set(ids(b.removed));
  const createdColumnIds = new Set(c.upserts.filter((x) => !c.prevMap.has(x.id)).map((x) => x.id));

  // cards + 담당자/라벨/체크리스트
  const k = diffById(prev.cards, next.cards);
  planUpserts(
    "cards",
    k,
    (x) => ({
      id: x.id,
      board_id: x.boardId,
      column_id: x.columnId,
      title: x.title,
      description: x.description,
      position: x.position,
      priority: x.priority,
      due_date: x.dueDate,
      deleted_at: null, // 소프트 삭제된 카드를 실행 취소로 되살릴 때 표시를 지운다
    }),
    (o, x) =>
      diffFields(o, x, [
        ["column_id", (t) => t.columnId],
        ["title", (t) => t.title],
        ["description", (t) => t.description],
        ["position", (t) => t.position],
        ["priority", (t) => t.priority],
        ["due_date", (t) => t.dueDate],
      ]),
    upserts,
  );
  // 컬럼·보드가 함께 지워지는 경우는 DB 연쇄 삭제에 맡기고, 카드만 지울 때는 소프트 삭제한다
  const softDeleted = k.removed.filter((x) => !removedColumnIds.has(x.columnId) && !removedBoardIds.has(x.boardId));
  if (softDeleted.length) deletes.push(softDeleteCards(ids(softDeleted)));

  for (const card of k.upserts) {
    const old = k.prevMap.get(card.id);
    const oldAssignees = old?.assigneeIds ?? [];
    const oldLabels = old?.labelIds ?? [];

    const addAssignees = card.assigneeIds.filter((u) => !oldAssignees.includes(u));
    if (addAssignees.length)
      upserts.push(() =>
        supabase
          .from("card_assignees")
          .upsert(addAssignees.map((user_id) => ({ card_id: card.id, user_id })), { ignoreDuplicates: true }),
      );
    for (const user_id of oldAssignees.filter((u) => !card.assigneeIds.includes(u)))
      deletes.push(() => supabase.from("card_assignees").delete().eq("card_id", card.id).eq("user_id", user_id));

    const addLabels = card.labelIds.filter((x) => !oldLabels.includes(x));
    if (addLabels.length)
      upserts.push(() =>
        supabase
          .from("card_labels")
          .upsert(addLabels.map((label_id) => ({ card_id: card.id, label_id })), { ignoreDuplicates: true }),
      );
    for (const label_id of oldLabels.filter((x) => !card.labelIds.includes(x)))
      deletes.push(() => supabase.from("card_labels").delete().eq("card_id", card.id).eq("label_id", label_id));

    if (JSON.stringify(old?.checklist ?? []) !== JSON.stringify(card.checklist)) {
      const keys = sequentialKeys(card.checklist.length);
      if (card.checklist.length)
        upserts.push(() =>
          supabase.from("checklist_items").upsert(
            card.checklist.map((item, i) => ({
              id: item.id,
              card_id: card.id,
              text: item.text,
              done: item.done,
              position: keys[i],
            })),
          ),
        );
      const keep = new Set(card.checklist.map((i) => i.id));
      const gone = (old?.checklist ?? []).filter((i) => !keep.has(i.id)).map((i) => i.id);
      if (gone.length) deletes.push(() => supabase.from("checklist_items").delete().in("id", gone));
    }
  }

  // comments
  const m = diffById(prev.comments, next.comments);
  const nextCardById = new Map(next.cards.map((x) => [x.id, x]));
  const createdCardIds = new Set(k.upserts.filter((x) => !k.prevMap.has(x.id)).map((x) => x.id));
  const commentRows = m.upserts.filter((x) => {
    // 소프트 삭제에서 되살린 카드의 댓글은 DB 에 그대로 있으므로 다시 쓰지 않는다.
    // (컬럼 삭제를 되돌리는 경우에만 DB 에서 사라졌으므로 내가 쓴 댓글에 한해 복원한다)
    if (!createdCardIds.has(x.cardId)) return true;
    const card = nextCardById.get(x.cardId);
    return !!card && createdColumnIds.has(card.columnId) && x.userId === next.me;
  });
  if (commentRows.length)
    upserts.push(() =>
      supabase
        .from("comments")
        .upsert(commentRows.map((x) => ({ id: x.id, card_id: x.cardId, user_id: x.userId, body: x.body }))),
    );
  // 카드가 함께 지워진 경우의 댓글은 카드에 딸려 보존되므로 건드리지 않는다
  const removedComments = m.removed.filter((x) => nextCardById.has(x.cardId));
  if (removedComments.length) deletes.push(strictDelete("comments", ids(removedComments)));

  // 알림 읽음 처리
  const oldNotifs = new Map(prev.notifications.map((n) => [n.id, n]));
  const nowRead = next.notifications.filter((n) => n.read && oldNotifs.get(n.id)?.read === false).map((n) => n.id);
  if (nowRead.length) upserts.push(() => supabase.from("notifications").update({ read: true }).in("id", nowRead));

  // 이메일 알림 설정
  if (JSON.stringify(prev.prefs) !== JSON.stringify(next.prefs))
    upserts.push(() =>
      supabase
        .from("notification_prefs")
        .update({
          email_mention: next.prefs.emailMention,
          email_assigned: next.prefs.emailAssigned,
          email_due: next.prefs.emailDue,
        })
        .eq("user_id", next.me),
    );

  return { upserts, deletes };
}

// ---------------------------------------------------------------
// 쓰기 큐 / 에러 처리
// ---------------------------------------------------------------
let pending = 0;
let writeSeq = 0; // 쓰기가 시작될 때마다 올라가는 번호
let queue: Promise<void> = Promise.resolve();
let needsRefetch = false;
const errorListeners = new Set<(message: string) => void>();

/** 저장 실패 알림을 받는다 (토스트 연결용) */
export function onSyncError(listener: (message: string) => void) {
  errorListeners.add(listener);
  return () => {
    errorListeners.delete(listener);
  };
}

function reportError(message: string) {
  console.error("[sync]", message);
  errorListeners.forEach((l) => l(message));
}

function enqueue(prev: AppState, next: AppState) {
  const { upserts, deletes } = planWrites(prev, next);
  if (upserts.length + deletes.length === 0) return;

  writeSeq++;
  pending++;
  queue = queue
    .then(async () => {
      let firstError: string | null = null;
      // 부모 → 자식 순서로 upsert, 이후 자식 → 부모 순서로 delete
      for (const write of [...upserts, ...deletes.reverse()]) {
        const { error } = await write();
        if (error && !firstError) firstError = error.message;
      }
      if (firstError) {
        reportError(firstError);
        needsRefetch = true; // 서버 상태로 되돌려 일관성 회복
      }
    })
    .catch((e: unknown) => {
      reportError(e instanceof Error ? e.message : String(e));
      needsRefetch = true;
    })
    .finally(() => {
      pending--;
      if (pending === 0 && needsRefetch) void refetch();
    });
}

// ---------------------------------------------------------------
// 재조회 / 실시간
// ---------------------------------------------------------------
let refetchTimer: ReturnType<typeof setTimeout> | null = null;

async function refetch() {
  if (pending > 0) {
    needsRefetch = true; // 쓰기가 끝난 뒤 실행
    return;
  }
  needsRefetch = false;
  const seq = writeSeq;
  try {
    const next = await fetchAll();
    if (pending > 0) {
      needsRefetch = true; // 조회 중에 쓰기가 시작됨 → 낙관적 상태 유지
      return;
    }
    if (writeSeq !== seq) {
      // 조회하는 사이에 쓰기가 시작되고 끝났다 → 이 결과는 쓰기 전 상태이므로 버리고 다시 읽는다
      scheduleRefetch();
      return;
    }
    replaceState(next);
  } catch (e) {
    reportError(e instanceof Error ? e.message : String(e));
  }
}

function scheduleRefetch() {
  if (refetchTimer) clearTimeout(refetchTimer);
  refetchTimer = setTimeout(() => void refetch(), 300);
}

let started = false;

export async function startSync() {
  if (started) return;
  started = true;

  attachBackend({ onCommit: enqueue });
  await refetch();

  const channel = supabase.channel("kanban-sync");
  for (const table of REALTIME_TABLES) {
    channel.on("postgres_changes", { event: "*", schema: "public", table }, scheduleRefetch);
  }
  channel.subscribe();

  // 탭이 다시 보이거나 네트워크가 복구되면 놓친 변경을 보충
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") scheduleRefetch();
  });
  window.addEventListener("online", scheduleRefetch);

}
