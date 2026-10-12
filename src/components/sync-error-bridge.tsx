"use client";

import { useEffect } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { useToast } from "./toast";

/** 서버 저장 실패를 토스트로 알린다 (Supabase 모드에서만 동작) */
export function SyncErrorBridge() {
  const toast = useToast();

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let off: (() => void) | undefined;
    let cancelled = false;
    void import("@/lib/sync/supabase-sync").then((m) => {
      if (cancelled) return;
      off = m.onSyncError(() => toast("저장에 실패했습니다. 최신 상태로 다시 불러옵니다."));
    });
    return () => {
      cancelled = true;
      off?.();
    };
  }, [toast]);

  return null;
}
