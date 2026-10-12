import { Suspense } from "react";
import { BoardView } from "@/components/board/board-view";

export default function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-zinc-400">불러오는 중…</p>}>
      <Board params={params} />
    </Suspense>
  );
}

async function Board({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BoardView boardId={id} />;
}
