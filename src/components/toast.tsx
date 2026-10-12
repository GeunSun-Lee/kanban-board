"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

interface ToastAction {
  label: string;
  onClick: () => void;
}
interface ToastItem {
  id: number;
  message: string;
  action?: ToastAction;
}

const ToastContext = createContext<((message: string, action?: ToastAction) => void) | null>(null);

const DURATION_MS = 6000;
const MAX_TOASTS = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, action?: ToastAction) => {
      const id = nextId.current++;
      setToasts((list) => [...list, { id, message, action }].slice(-MAX_TOASTS));
      timers.current.set(id, setTimeout(() => dismiss(id), DURATION_MS));
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((t) => clearTimeout(t));
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-center gap-3 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
          >
            <span>{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="font-semibold text-blue-300 hover:underline dark:text-blue-600"
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              aria-label="알림 닫기"
              className="text-zinc-400 hover:text-white dark:hover:text-zinc-900"
              onClick={() => dismiss(t.id)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** 삭제 직후 "실행 취소" 토스트를 보여주는 헬퍼 */
export function useUndoToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error("ToastProvider 안에서 사용해야 합니다");
  return useCallback(
    (message: string, undo: () => void) => show(message, { label: "실행 취소", onClick: undo }),
    [show],
  );
}

/** 일반 안내 토스트 */
export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error("ToastProvider 안에서 사용해야 합니다");
  return useCallback((message: string) => show(message), [show]);
}
