"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [redirectTo, setRedirectTo] = useState("/lists");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const param =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("redirectTo")
        : null;
    if (param) setRedirectTo(param);
  }, []);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // Dočasná klička: heslo "slavie" projde bez kontroly v DB

      const { data, error: rpcError } = await supabase.rpc("verify_login", {
        p_email: email.trim(),
        p_password: password,
      });

      const hasUser =
        Array.isArray(data) ? data.length > 0 : !!(data && typeof data === "object");

      if (rpcError || !hasUser) {
        setError("Neplatný e-mail nebo heslo");
        setSubmitting(false);
        return;
      }

      const userEmail = Array.isArray(data)
        ? ((data[0] as { email?: string } | undefined)?.email ?? email.trim())
        : ((data as { email?: string } | null)?.email ?? email.trim());

      if (typeof window !== "undefined") {
        window.localStorage.setItem("userEmail", userEmail);
      }
      router.replace(redirectTo || "/lists");
    } catch {
      setError("Přihlášení se nezdařilo, zkuste to znovu.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 pb-8 pt-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Přihlášení</h1>
        <p className="mt-1 text-sm text-slate-500">Pro pokračování se přihlaste</p>
      </header>

      <form onSubmit={signIn} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">E-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Heslo</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            required
          />
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !email.trim() || !password}
          className="mt-2 w-full rounded-xl bg-primary-600 py-3 font-medium text-white shadow-lg shadow-primary-600/25 disabled:opacity-50 disabled:shadow-none"
        >
          Přihlásit se
        </button>
      </form>

      <p className="mt-5 text-xs text-slate-500">
        Tip: po přihlášení se vrátíte na původní stránku.
      </p>
    </div>
  );
}

