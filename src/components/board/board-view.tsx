"use client";

import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import {
  addColumn,
  boardColumns,
  columnCards,
  moveCard,
  moveColumn,
  renameBoard,
  useAppState,
} from "@/lib/demo-store";
import { PRIORITIES, type Card, type Priority } from "@/lib/types";
import { NotificationBell } from "@/components/notification-bell";
import { ActivityPanel } from "./activity-panel";
import { CardDialog } from "./card-dialog";
import { CardView } from "./card-view";
import { Column } from "./column";

type Items = Record<string, string[]>;
type Active = { type: "card" | "column"; id: string } | null;

export function BoardView({ boardId }: { boardId: string }) {
  const state = useAppState();
  const router = useRouter();
  const pathname = usePathname();
  const paramCard = useSearchParams().get("card");

  const [active, setActive] = useState<Active>(null);
  // 드래그 중에만 사용하는 임시 배치 (컬럼 간 이동 미리보기)
  const [override, setOverride] = useState<Items | null>(null);
  const [localOpenId, setLocalOpenId] = useState<string | null>(null);
  // 알림 등에서 ?card= 로 들어온 경우 해당 카드를 연다 (닫으면 다시 열리지 않도록 기억)
  const [dismissedParam, setDismissedParam] = useState<string | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);
  if (paramCard === null && dismissedParam !== null) setDismissedParam(null);
  const openCardId = localOpenId ?? (paramCard !== dismissedParam ? paramCard : null);
  const [newColumn, setNewColumn] = useState("");

  const [query, setQuery] = useState("");
  const [assignee, setAssignee] = useState("all");
  const [priority, setPriority] = useState<"all" | Priority>("all");
  const [labelFilter, setLabelFilter] = useState("all");
  const [mineOnly, setMineOnly] = useState(false);

  const board = state?.boards.find((b) => b.id === boardId);
  const columns = useMemo(() => (state ? boardColumns(state, boardId) : []), [state, boardId]);
  const cardsById = useMemo(() => new Map((state?.cards ?? []).map((c) => [c.id, c])), [state]);

  const boardLabels = useMemo(() => (state?.labels ?? []).filter((l) => l.boardId === boardId), [state, boardId]);
  const commentCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of state?.comments ?? []) map.set(c.cardId, (map.get(c.cardId) ?? 0) + 1);
    return map;
  }, [state]);

  const baseItems = useMemo<Items>(() => {
    const result: Items = {};
    if (state) for (const col of columns) result[col.id] = columnCards(state, col.id).map((c) => c.id);
    return result;
  }, [state, columns]);
  const items = override ?? baseItems;

  const filtering =
    query.trim() !== "" || assignee !== "all" || priority !== "all" || labelFilter !== "all" || mineOnly;
  const matches = useCallback(
    (card: Card) => {
      if (query.trim() && !`${card.title} ${card.description}`.toLowerCase().includes(query.trim().toLowerCase()))
        return false;
      if (assignee !== "all" && !card.assigneeIds.includes(assignee)) return false;
      if (priority !== "all" && card.priority !== priority) return false;
      if (labelFilter !== "all" && !card.labelIds.includes(labelFilter)) return false;
      if (mineOnly && !card.assigneeIds.includes(state?.me ?? "")) return false;
      return true;
    },
    [query, assignee, priority, labelFilter, mineOnly, state?.me],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    }),
  );

  const findContainer = useCallback(
    (id: string) => (id in items ? id : Object.keys(items).find((k) => items[k].includes(id))),
    [items],
  );

  const collisionDetection = useCallback<CollisionDetection>(
    (args) => {
      if (args.active.data.current?.type === "column") {
        return closestCenter({
          ...args,
          droppableContainers: args.droppableContainers.filter((c) => c.data.current?.type === "column"),
        });
      }
      const pointer = pointerWithin(args);
      const hits = pointer.length > 0 ? pointer : rectIntersection(args);
      let overId = hits[0]?.id;
      if (overId !== undefined && String(overId) in items) {
        const colItems = items[String(overId)];
        if (colItems.length > 0) {
          // 컬럼 위에 있으면 그 안에서 가장 가까운 카드를 대상으로 삼음
          const closest = closestCenter({
            ...args,
            droppableContainers: args.droppableContainers.filter(
              (c) => c.id !== overId && colItems.includes(String(c.id)),
            ),
          });
          overId = closest[0]?.id ?? overId;
        }
      }
      return overId !== undefined ? [{ id: overId }] : [];
    },
    [items],
  );

  if (!state) return <p className="p-6 text-sm text-zinc-400">불러오는 중…</p>;
  if (!board) {
    return (
      <div className="p-6">
        <p className="text-sm text-zinc-500">보드를 찾을 수 없습니다.</p>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          보드 목록으로
        </Link>
      </div>
    );
  }

  function onDragStart({ active }: DragStartEvent) {
    const type = active.data.current?.type === "column" ? "column" : "card";
    setActive({ type, id: String(active.id) });
    if (type === "card") setOverride(structuredClone(baseItems));
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over || !override || active.data.current?.type === "column") return;
    const activeId = String(active.id);
    const activeC = findContainer(activeId);
    const overC = findContainer(String(over.id));
    if (!activeC || !overC || activeC === overC) return;

    setOverride((prev) => {
      if (!prev) return prev;
      const overItems = prev[overC];
      const overIndex = overItems.indexOf(String(over.id));
      let newIndex = overItems.length;
      if (!(String(over.id) in prev) && overIndex >= 0) {
        const translated = active.rect.current.translated;
        const below = translated ? translated.top > over.rect.top + over.rect.height / 2 : false;
        newIndex = overIndex + (below ? 1 : 0);
      }
      return {
        ...prev,
        [activeC]: prev[activeC].filter((i) => i !== activeId),
        [overC]: [...overItems.slice(0, newIndex), activeId, ...overItems.slice(newIndex)],
      };
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const activeId = String(active.id);

    if (active.data.current?.type === "column") {
      if (over && over.id !== active.id) {
        const to = columns.findIndex((c) => c.id === over.id);
        if (to >= 0) moveColumn(activeId, to);
      }
    } else if (over && override) {
      const container = findContainer(activeId);
      const overC = findContainer(String(over.id));
      if (container && overC === container) {
        const list = override[container];
        const from = list.indexOf(activeId);
        const to = list.indexOf(String(over.id));
        const finalList = to >= 0 && from !== to ? arrayMove(list, from, to) : list;
        moveCard(activeId, container, finalList.indexOf(activeId));
      }
    }
    setActive(null);
    setOverride(null);
  }

  function onDragCancel() {
    setActive(null);
    setOverride(null);
  }

  const activeCard = active?.type === "card" ? cardsById.get(active.id) : undefined;
  const activeColumn = active?.type === "column" ? columns.find((c) => c.id === active.id) : undefined;
  const openCard = openCardId ? cardsById.get(openCardId) : undefined;
  const lastColumnId = columns.at(-1)?.id;

  const control =
    "rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-zinc-700";

  return (
    <div className="flex h-dvh min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <Link href="/" className="text-sm text-zinc-500 hover:underline">
          ← 보드 목록
        </Link>
        <input
          key={board.name}
          defaultValue={board.name}
          maxLength={100}
          aria-label="보드 이름"
          className="min-w-0 rounded bg-transparent px-1 text-lg font-semibold outline-none focus:bg-zinc-100 dark:focus:bg-zinc-800"
          onBlur={(e) => {
            const name = e.target.value.trim();
            if (name && name !== board.name) renameBoard(board.id, name);
            else e.target.value = board.name;
          }}
        />
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            onClick={() => setActivityOpen(true)}
          >
            활동
          </button>
          <NotificationBell />
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 px-4 py-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="카드 검색"
          aria-label="카드 검색"
          className={`${control} w-44`}
        />
        <select
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          aria-label="담당자 필터"
          className={control}
        >
          <option value="all" className="text-zinc-900">
            모든 담당자
          </option>
          {state.members.map((m) => (
            <option key={m.id} value={m.id} className="text-zinc-900">
              {m.name}
            </option>
          ))}
        </select>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as "all" | Priority)}
          aria-label="우선순위 필터"
          className={control}
        >
          <option value="all" className="text-zinc-900">
            모든 우선순위
          </option>
          {PRIORITIES.map((p) => (
            <option key={p.value} value={p.value} className="text-zinc-900">
              {p.label}
            </option>
          ))}
        </select>
        <select
          value={labelFilter}
          onChange={(e) => setLabelFilter(e.target.value)}
          aria-label="라벨 필터"
          className={control}
        >
          <option value="all" className="text-zinc-900">
            모든 라벨
          </option>
          {boardLabels.map((l) => (
            <option key={l.id} value={l.id} className="text-zinc-900">
              {l.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />내 카드만
        </label>
        {filtering && (
          <>
            <button
              type="button"
              className="text-sm text-blue-600 hover:underline"
              onClick={() => {
                setQuery("");
                setAssignee("all");
                setPriority("all");
                setLabelFilter("all");
                setMineOnly(false);
              }}
            >
              필터 초기화
            </button>
            <span className="text-xs text-zinc-500">필터 중에는 카드·컬럼을 이동할 수 없습니다</span>
          </>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <div className="flex min-h-0 flex-1 items-start gap-3 overflow-x-auto px-4 pb-4">
          <SortableContext items={columns.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
            {columns.map((col) => {
              const visible = (items[col.id] ?? [])
                .map((id) => cardsById.get(id))
                .filter((c): c is Card => !!c && matches(c));
              return (
                <Column
                  key={col.id}
                  column={col}
                  cards={visible}
                  totalCount={baseItems[col.id]?.length ?? 0}
                  members={state.members}
                  labels={boardLabels}
                  commentCounts={commentCounts}
                  isLast={col.id === lastColumnId}
                  canDelete={state.isAdmin}
                  dragDisabled={filtering}
                  onOpenCard={setLocalOpenId}
                />
              );
            })}
          </SortableContext>

          <form
            className="w-72 shrink-0 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              const name = newColumn.trim();
              if (!name) return;
              addColumn(boardId, name);
              setNewColumn("");
            }}
          >
            <input
              value={newColumn}
              onChange={(e) => setNewColumn(e.target.value)}
              maxLength={50}
              placeholder="+ 컬럼 추가"
              aria-label="새 컬럼 이름"
              className="w-full rounded-xl border border-dashed border-zinc-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-blue-500 dark:border-zinc-700"
            />
          </form>
        </div>

        <DragOverlay>
          {activeCard && (
            <CardView
              card={activeCard}
              members={state.members}
              labels={boardLabels}
              commentCount={commentCounts.get(activeCard.id) ?? 0}
            />
          )}
          {activeColumn && (
            <div className="w-72 rounded-xl border border-zinc-300 bg-zinc-100 p-3 text-sm font-semibold shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              {activeColumn.name}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {openCard && (
        <CardDialog
          key={openCard.id}
          card={openCard}
          columnName={columns.find((c) => c.id === openCard.columnId)?.name ?? ""}
          members={state.members}
          labels={boardLabels}
          comments={state.comments.filter((c) => c.cardId === openCard.id)}
          activity={state.activity.filter((a) => a.cardId === openCard.id)}
          me={state.me}
          onClose={() => {
            setLocalOpenId(null);
            if (paramCard) {
              setDismissedParam(paramCard);
              router.replace(pathname);
            }
          }}
        />
      )}
      {activityOpen && (
        <ActivityPanel
          items={state.activity.filter((a) => a.boardId === boardId)}
          members={state.members}
          existingCardIds={new Set(state.cards.map((c) => c.id))}
          onOpenCard={setLocalOpenId}
          onClose={() => setActivityOpen(false)}
        />
      )}
    </div>
  );
}
