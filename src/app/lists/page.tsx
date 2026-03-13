"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { ShoppingList } from "@/lib/supabase";

import type { UserListDashboardItem } from "@/lib/supabase";
import { nanoid } from "nanoid";

export default function ListsPage() {
  const router = useRouter();
  //const [lists, setLists] = useState<ShoppingList[]>([]);
  const [lists, setLists] = useState<UserListDashboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [allBoughtListIds, setAllBoughtListIds] = useState<Set<string>>(new Set());

  function formatListDate(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric" });
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      const email = window.localStorage.getItem("userEmail");
      if (!email) {
        router.replace("/login?redirectTo=/lists");
        return;
      }
      setCurrentUserEmail(email);
    }

    loadLists();

    const channel = supabase
      .channel("lists-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shopping_lists" },
        () => loadLists()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shopping_items" },
        () => loadLists()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  /*async function loadLists() {
    const { data: listData } = await supabase
      .from("list_access")
      .select("*")
      .is("user_email", currentUserEmail)
      .order("created_at", { ascending: false });

    const { data: itemsData } = await supabase
      .from("shopping_items")
      .select("list_id, checked");

    const listIdsWithItems = new Set<string>();
    const listIdsWithUnchecked = new Set<string>();
    for (const row of itemsData || []) {
      const listId = (row as { list_id: string }).list_id;
      listIdsWithItems.add(listId);
      if (!(row as { checked: boolean }).checked) listIdsWithUnchecked.add(listId);
    }
    const allBought = new Set<string>();
    listIdsWithItems.forEach((id) => {
      if (!listIdsWithUnchecked.has(id)) allBought.add(id);
    });
    setAllBoughtListIds(allBought);

    const sorted = (listData || []).sort((a, b) => {
      const aAllBought = allBought.has(a.id);
      const bAllBought = allBought.has(b.id);
      if (aAllBought !== bAllBought) return aAllBought ? 1 : -1;
      const fa = (a as ShoppingList).is_favorite ? 1 : 0;
      const fb = (b as ShoppingList).is_favorite ? 1 : 0;
      if (fa !== fb) return fb - fa;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    setLists(sorted);
    setLoading(false);
  }*/

  async function loadLists() {
    const userEmail =
      typeof window !== "undefined" ? window.localStorage.getItem("userEmail") : null;
    const { data: listData } = await supabase
      .from("list_access")
      .select(`
        *,
        shopping_lists (
          name,
          hash,
          owner_email,
          archived_at,
          created_at
        )
      `)
      .eq("user_email", userEmail)
      .is("shopping_lists.archived_at", null)
      .order("position", { ascending: false });

    const { data: itemsData } = await supabase
      .from("shopping_items")
      .select("list_id, checked");

    const listIdsWithItems = new Set<string>();
    const listIdsWithUnchecked = new Set<string>();
    for (const row of itemsData || []) {
      const listId = (row as { list_id: string }).list_id;
      listIdsWithItems.add(listId);
      if (!(row as { checked: boolean }).checked) listIdsWithUnchecked.add(listId);
    }
    const allBought = new Set<string>();
    listIdsWithItems.forEach((id) => {
      if (!listIdsWithUnchecked.has(id)) allBought.add(id);
    });
    setAllBoughtListIds(allBought);

    // 3. Finální seřazení
    const sorted = (listData || []).sort((a, b) => {
      // POZOR: Tady používáme a.list_id (pokud ho máš v list_access) nebo a.list_hash
      const aAllBought = allBought.has(a.list_id); 
      const bAllBought = allBought.has(b.list_id);
      
      if (aAllBought !== bAllBought) return aAllBought ? 1 : -1;
      
      // Použijeme tvé sloupce z list_access
      const fa = a.is_favorite ? 1 : 0;
      const fb = b.is_favorite ? 1 : 0;
      if (fa !== fb) return fb - fa;
      
      // Pokud chceš držet původní řazení, můžeš, ale position už by to mělo řešit
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    setLists(sorted as unknown as UserListDashboardItem[]);
    setLoading(false);
  }

  /*async function createList() {
    const hash = nanoid(10);
    const ownerEmail =
      typeof window !== "undefined" ? window.localStorage.getItem("userEmail") : null;
    const shareToken = nanoid(16);
    const { data } = await supabase
      .from("shopping_lists")
      .insert({
        hash,
        name: "Nový seznam",
        owner_email: ownerEmail,
        share_token: shareToken,
        permission_level: "read-only",
      })
      .select()
      .single();
    if (data) router.push(`/list/${data.hash}`);
  }*/

    async function createList() {
    const hash = nanoid(10);
    const ownerEmail =
      typeof window !== "undefined" ? window.localStorage.getItem("userEmail") : null;
    const shareToken = nanoid(16);
    const { data } = await supabase
      .from("shopping_lists")
      .insert({
        hash,
        name: "Nový seznam",
        owner_email: ownerEmail,
        share_token: shareToken,
        permission_level: "read-only",
      })
      .select()
      .single();

      // 2. Vytvoření přístupu (pro majitele)
      await supabase.from("list_access").insert({
        list_id: data.id, // Tady použijeme ID, které právě vzniklo
        user_email: ownerEmail,        
        share_token: shareToken,
        permission_level: "owner",
        position: 0, // nebo poslední známá pozice
        is_favorite: false,
      });

      // 2. Vytvoření přístupu (pro Elišku / Karla natvrdo)
      // 1. Připravíme si email pro zápis (logika přepsání)
      const emailToSave = ownerEmail === "karlosprot@gmail.com" ? "eliska.hoffmannova3@gmail.com" : ownerEmail;

      await supabase.from("list_access").insert({
        list_id: data.id, // Tady použijeme ID, které právě vzniklo
        user_email: emailToSave,        
        share_token: shareToken,
        permission_level: "edit",
        position: 0, // nebo poslední známá pozice
        is_favorite: false,
      });

    if (data) router.push(`/list/${data.hash}`);
  }

  async function deleteList(list: UserListDashboardItem) {
    const confirmed = confirm(`Opravdu smazat seznam "${list.shopping_lists?.name}"?`);
    if (!confirmed) return;

    await supabase.from("shopping_lists").delete().eq("id", list.list_id);
    await loadLists();
  }

  async function shareList(list: UserListDashboardItem) {

    const query = list.share_token ? `?token=${list.share_token}` : "";
    // Hash nyní bereme z vnořeného objektu
    const listHash = list.shopping_lists?.hash;   
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/list/${listHash}${query}`
        : `/list/${listHash}${query}`;

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

  async function signOut() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("userEmail");
    }
    router.replace("/login");
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
      <header className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-800">Nákupní seznamy</h1>
          <p className="mt-1 text-sm text-slate-500">Vyberte seznam nebo vytvořte nový</p>
        </div>
        <button
          onClick={signOut}
          className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          Odhlásit
        </button>
      </header>

      <button
        onClick={createList}
        className="mb-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 py-4 font-medium text-white shadow-lg shadow-primary-600/25 transition active:scale-[0.98]"
      >
        <span className="text-xl">+</span>
        Nový seznam
      </button>

      <div className="space-y-2">
        {lists.length === 0 ? (
          <p className="py-8 text-center text-slate-500">
            Zatím nemáte žádné seznamy
          </p>
        ) : (
          lists.map((list) => (
            <div
              key={list.id}
              className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm transition hover:border-primary-500/50 hover:bg-primary-50/50 active:bg-primary-100/50"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const next = !list.is_favorite;
                  supabase
                    .from("access_list")
                    .update({ is_favorite: next })
                    .eq("id", list.id)
                    .then(() => {
                      setLists((prev) =>
                        prev
                          .map((l) => (l.id === list.id ? { ...l, is_favorite: next } : l))
                          .sort((a, b) => {
                            const fa = a.is_favorite ? 1 : 0;
                            const fb = b.is_favorite ? 1 : 0;
                            if (fa !== fb) return fb - fa;
                            
                            // Tady bacha na to Date - musí tam být created_at!
                            return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
                          })
                      );
                    });
                }}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-transparent text-yellow-400 hover:text-yellow-500"
                aria-label={list.is_favorite ? "Odebrat z oblíbených" : "Přidat do oblíbených"}
              >
                {list.is_favorite ? (
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.073 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.802 2.036a1 1 0 00-.364 1.118l1.073 3.292c.3.921-.755 1.688-1.54 1.118l-2.802-2.036a1 1 0 00-1.175 0L6.76 16.183c-.784.57-1.838-.197-1.539-1.118l1.073-3.292a1 1 0 00-.364-1.118L3.128 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.073-3.292z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.163c.969 0 1.371 1.24.588 1.81l-3.37 2.449a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.449a1 1 0 00-1.175 0l-3.37 2.449c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.962 9.384c-.783-.57-.38-1.81.588-1.81h4.163a1 1 0 00.951-.69l1.286-3.957z" />
                  </svg>
                )}
              </button>
              <button
                onClick={() => router.push(`/list/${list.shopping_lists?.hash}`)}
                className="flex flex-1 items-center justify-between text-left min-w-0"
              >
                <span
                  className={`font-medium truncate ${
                    allBoughtListIds.has(list.id)
                      ? "text-slate-500"
                      : "text-slate-800"
                  }`}
                >
                  <span
                    className={`font-medium truncate ${
                      allBoughtListIds.has(list.id)
                        ? "line-through"
                        : ""
                    }`}
                  >
                    {list.shopping_lists?.name}
                  </span>
                  <span className="ml-1 text-xs font-normal text-slate-500">
                    ({formatListDate(list.shopping_lists?.created_at)})
                  </span>
                </span>
                <span className="ml-2 text-slate-400 shrink-0">›</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  shareList(list);
                }}
                className="ml-2 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
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
                onClick={(e) => {
                  e.stopPropagation();
                  deleteList(list);
                }}
                className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500"
                aria-label="Smazat seznam"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
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

      <nav className="mt-auto pt-8">
        <a
          href="/archive"
          className="block text-center text-sm text-slate-500 underline"
        >
          Archivované seznamy
        </a>
      </nav>
    </div>
  );
}
