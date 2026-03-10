"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { ShoppingList } from "@/lib/supabase";

export default function ArchivePage() {
  const router = useRouter();
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  function formatListDate(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric" });
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      const email = window.localStorage.getItem("userEmail");
      if (!email) {
        router.replace("/login?redirectTo=/archive");
        return;
      }
    }

    loadArchived();
  }, []);

  async function loadArchived() {
    const { data } = await supabase
      .from("shopping_lists")
      .select("*")
      .not("archived_at", "is", null)
      .order("archived_at", { ascending: false });
    setLists(data || []);
    setLoading(false);
  }

  async function unarchive(list: ShoppingList) {
    await supabase
      .from("shopping_lists")
      .update({ archived_at: null })
      .eq("id", list.id);
    router.push(`/list/${list.hash}`);
  }

  async function shareList(list: ShoppingList) {
    const query = list.share_token ? `?token=${list.share_token}` : "";
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/list/${list.hash}${query}`
        : `/list/${list.hash}${query}`;

    if (typeof navigator?.share === "function") {
      try {
        await navigator.share({ title: list.name, url });
        return;
      } catch {
        // fallback to clipboard
      }
    }

    try {
      await navigator.clipboard?.writeText(url);
      setCopiedHash(list.hash);
      window.setTimeout(() => setCopiedHash((h) => (h === list.hash ? null : h)), 1500);
    } catch {
      alert("Nepodařilo se zkopírovat odkaz.");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-slate-400">Načítání...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 pb-8 pt-6">
      <header className="mb-6 flex items-center gap-3">
        <button
          onClick={() => router.push("/lists")}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
          aria-label="Zpět"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-slate-800">Archivované seznamy</h1>
      </header>

      <p className="mb-6 text-sm text-slate-500">
        Seznamy starší 1 měsíce se archivují automaticky.
      </p>

      <div className="space-y-2">
        {lists.length === 0 ? (
          <p className="py-8 text-center text-slate-500">Žádné archivované seznamy</p>
        ) : (
          lists.map((list) => (
            <div
              key={list.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
            >
              <span className="font-medium text-slate-800 truncate">
                {list.name}
                <span className="ml-1 text-xs font-normal text-slate-500">
                  ({formatListDate(list.created_at)})
                </span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => shareList(list)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Sdílet odkaz"
                  title="Sdílet odkaz"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.684 13.342C9.886 14.512 11.585 15.2 13.5 15.2c3.314 0 6-2.06 6-4.6S16.814 6 13.5 6c-1.915 0-3.614.688-4.816 1.858m0 5.484C7.482 12.172 5.783 11.484 3.868 11.484 2.046 11.484.5 10.46.5 9.2S2.046 6.916 3.868 6.916c1.915 0 3.614.688 4.816 1.858m0 4.568V8.774"
                    />
                  </svg>
                </button>
                <button
                  onClick={() => unarchive(list)}
                  className="rounded-lg bg-primary-100 px-3 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-200"
                >
                  Obnovit
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {copiedHash && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 flex justify-center px-4">
          <div className="rounded-full bg-slate-900/90 px-4 py-2 text-sm text-white shadow-lg">
            Odkaz zkopírován
          </div>
        </div>
      )}
    </div>
  );
}
