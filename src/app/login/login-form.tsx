"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

export function LoginForm() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<{ type: "error" | "info"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const redirectTo = () => `${window.location.origin}/auth/callback`;

  async function signInWithProvider(provider: "google" | "github") {
    setMessage(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: redirectTo() },
    });
    if (error) setMessage({ type: "error", text: "로그인에 실패했습니다. 다시 시도해 주세요." });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage({ type: "error", text: "이메일 또는 비밀번호가 올바르지 않습니다." });
      } else {
        router.replace("/");
        router.refresh();
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectTo() },
      });
      if (error) {
        // 초대되지 않은 이메일은 DB 트리거가 거부 → "Database error saving new user"
        setMessage({
          type: "error",
          text: "가입할 수 없습니다. 초대받은 이메일인지, 비밀번호가 6자 이상인지 확인해 주세요.",
        });
      } else {
        setMessage({ type: "info", text: "확인 메일을 보냈습니다. 메일의 링크를 눌러 가입을 완료하세요." });
      }
    }
    setLoading(false);
  }

  const input =
    "w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-zinc-700";
  const button =
    "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800";

  return (
    <div className="mt-5 space-y-4">
      <div className="space-y-2">
        <button type="button" className={button} onClick={() => signInWithProvider("google")}>
          Google로 계속하기
        </button>
        <button type="button" className={button} onClick={() => signInWithProvider("github")}>
          GitHub로 계속하기
        </button>
      </div>

      <div className="flex items-center gap-3 text-xs text-zinc-400">
        <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        또는
        <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="이메일"
          className={input}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          required
          minLength={6}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          placeholder="비밀번호"
          className={input}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {mode === "signin" ? "로그인" : "가입하기"}
        </button>
      </form>

      {message && (
        <p
          role={message.type === "error" ? "alert" : "status"}
          className={`text-sm ${message.type === "error" ? "text-red-600" : "text-green-700"}`}
        >
          {message.text}
        </p>
      )}

      <button
        type="button"
        className="w-full text-center text-sm text-zinc-500 hover:underline"
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setMessage(null);
        }}
      >
        {mode === "signin" ? "초대받았나요? 가입하기" : "이미 계정이 있나요? 로그인"}
      </button>
    </div>
  );
}
