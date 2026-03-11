"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { ShoppingItem, ShoppingList, ItemPrice } from "@/lib/supabase";

export default function ListPage() {
  const params = useParams();
  const router = useRouter();
  const hash = params.hash as string;

  const [list, setList] = useState<ShoppingList | null>(null);
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [listName, setListName] = useState("");
  const [priceModalItem, setPriceModalItem] = useState<ShoppingItem | null>(null);
  const [prices, setPrices] = useState<ItemPrice[]>([]);
  const [priceStore, setPriceStore] = useState("");
  const [priceValue, setPriceValue] = useState("");
  const [priceQuantity, setPriceQuantity] = useState("");
  const [minPrices, setMinPrices] = useState<Record<string, { value: number; unit: string | null }>>({});

  const itemIdsRef = useRef<Set<string>>(new Set());
  const [isOwner, setIsOwner] = useState(true);
  const [canEdit, setCanEdit] = useState(true);

  function formatCzk(value: number) {
    const rounded = Math.round(value * 10) / 10;
    const asInt = Math.round(rounded);
    if (Math.abs(rounded - asInt) < 1e-9) return String(asInt);
    return String(rounded).replace(".", ",");
  }

  function formatDateShort(iso: string | null | undefined) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric" });
  }

  function formatDateTime(iso: string | null | undefined) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("cs-CZ", {
      day: "numeric",
      month: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const loadList = useCallback(async () => {
    const { data: listData } = await supabase
      .from("shopping_lists")
      .select("*")
      .eq("hash", hash)
      .single();

    if (!listData) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setList(listData);
    setListName(listData.name);

    // Zjištění vlastníka a tokenu na klientu
    let userEmail: string | null = null;
    let tokenFromUrl: string | null = null;
    if (typeof window !== "undefined") {
      userEmail = window.localStorage.getItem("userEmail");
      const params = new URLSearchParams(window.location.search);
      tokenFromUrl = params.get("token");
    }

    const ownerEmail = (listData as ShoppingList).owner_email ?? null;
    const isOwnerNow = !ownerEmail || (userEmail !== null && ownerEmail === userEmail);

    if (!isOwnerNow) {
      const shareTokenValue = (listData as ShoppingList).share_token ?? null;
      const tokenMatches = !!tokenFromUrl && !!shareTokenValue && tokenFromUrl === shareTokenValue;
      if (!tokenMatches) {
        setNotFound(true);
        setLoading(false);
        return;
      }
    }

    const permission = (listData as ShoppingList).permission_level ?? "read-only";
    const canEditNow = isOwnerNow || permission === "edit";
    setIsOwner(isOwnerNow);
    setCanEdit(canEditNow);

    const { data: itemsData } = await supabase
      .from("shopping_items")
      .select("*")
      .eq("list_id", listData.id)
      .order("checked", { ascending: true })
      .order("position", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: true });

    const resolvedItems = (itemsData || []).sort((a, b) => {
      const fa = (a as ShoppingItem).is_favorite ? 1 : 0;
      const fb = (b as ShoppingItem).is_favorite ? 1 : 0;
      if (fa !== fb) return fb - fa; // oblíbené nahoru
      if (a.checked === b.checked) {
        const pa = (a as ShoppingItem).position ?? 0;
        const pb = (b as ShoppingItem).position ?? 0;
        if (pa !== pb) return pa - pb;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return a.checked ? 1 : -1;
    });
    setItems(resolvedItems);

    const itemIds = resolvedItems.map((i) => i.id);
    if (itemIds.length === 0) {
      setMinPrices({});
    } else {
      const { data: priceData } = await supabase
        .from("item_prices")
        .select("item_id, price, unit_price, quantity_unit")
        .in("item_id", itemIds);

      const nextMinPrices: Record<string, { value: number; unit: string | null }> = {};
      for (const p of priceData || []) {
        const row = p as unknown as Partial<ItemPrice>;
        const value = Number(row.unit_price ?? row.price);
        if (!Number.isFinite(value)) continue;
        const rawUnit = row.quantity_unit;
        const unit = typeof rawUnit === "string" && rawUnit.trim() ? rawUnit.trim() : null;
        const itemId = String(row.item_id);
        const current = nextMinPrices[itemId];
        if (!current || value < current.value || (value === current.value && !current.unit && unit)) {
          nextMinPrices[itemId] = { value, unit };
        }
      }
      setMinPrices(nextMinPrices);
    }

    setLoading(false);
  }, [hash]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const email = window.localStorage.getItem("userEmail");
      if (!email) {
        router.replace(`/login?redirectTo=/list/${hash}`);
        return;
      }
    }
  }, [router, hash]);

  useEffect(() => {
    loadList();
  }, [hash, loadList]);

  useEffect(() => {
    if (!list?.id) return;

    const channel = supabase
      .channel(`list-${hash}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shopping_items", filter: `list_id=eq.${list.id}` },
        loadList
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shopping_lists", filter: `hash=eq.${hash}` },
        loadList
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [hash, list?.id, loadList]);

  useEffect(() => {
    itemIdsRef.current = new Set(items.map((i) => i.id));
  }, [items]);

  useEffect(() => {
    if (!list?.id) return;

    const channel = supabase
      .channel(`list-prices-${hash}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "item_prices" }, (payload) => {
        const itemId =
          (payload.new as { item_id?: string } | null)?.item_id ??
          (payload.old as { item_id?: string } | null)?.item_id;
        if (itemId && itemIdsRef.current.has(itemId)) loadList();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [hash, list?.id, loadList]);

  useEffect(() => {
    if (!priceModalItem) return;
    async function loadPrices() {
      const { data } = await supabase
        .from("item_prices")
        .select("*")
        .eq("item_id", priceModalItem!.id);
      const sorted = (data || []).sort((a, b) => Number(a.unit_price ?? a.price) - Number(b.unit_price ?? b.price));
      setPrices(sorted);
    }
    loadPrices();
    setPriceStore("");
    setPriceValue("");
    setPriceQuantity("");

    const channel = supabase
      .channel(`prices-${priceModalItem.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "item_prices", filter: `item_id=eq.${priceModalItem.id}` },
        loadPrices
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [priceModalItem]);

  async function addPriceEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!priceModalItem || !priceStore.trim()) return;
    const priceNum = parseFloat(priceValue.replace(",", "."));
    if (isNaN(priceNum) || priceNum < 0) return;

    const qtyTrimmed = priceQuantity.trim();
    const qtyMatch = qtyTrimmed.match(/^(\d+[,.]?\d*)\s*(.*)$/);
    const quantityNum = qtyMatch
      ? (parseFloat(qtyMatch[1].replace(",", ".")) || 1)
      : 1;
    const quantityUnit = qtyMatch && qtyMatch[2].trim() ? qtyMatch[2].trim() : null;
    if (quantityNum <= 0) return;
    const unitPrice = Math.round((priceNum / quantityNum) * 10) / 10;

    await supabase.from("item_prices").insert({
      item_id: priceModalItem.id,
      store_name: priceStore.trim(),
      price: priceNum,
      quantity: quantityNum,
      quantity_unit: quantityUnit,
      unit_price: unitPrice,
    });
    setPriceStore("");
    setPriceValue("");
    setPriceQuantity("");
    const { data } = await supabase
      .from("item_prices")
      .select("*")
      .eq("item_id", priceModalItem.id);
    const sorted = (data || []).sort((a, b) => Number(a.unit_price ?? a.price) - Number(b.unit_price ?? b.price));
    setPrices(sorted);
  }

  async function deletePriceEntry(item: ItemPrice) {
    await supabase.from("item_prices").delete().eq("id", item.id);
    setPrices((prev) => prev.filter((p) => p.id !== item.id));
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    const name = input.trim();
    if (!name || !list) return;

     // Kontrola duplicity v rámci jednoho seznamu (case-insensitive)
    const exists = items.some(
      (i) => i.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (exists) {
      alert("Tato položka už je v seznamu.");
      return;
    }

    let kupiUrl: string | null = null;
    try {
      const res = await fetch(
        `/api/kupi-url?item=${encodeURIComponent(name)}`,
        { method: "GET" }
      );
      if (res.ok) {
        const data = (await res.json()) as { url?: string | null };
        kupiUrl = data.url ?? null;
      }
    } catch {
      // fallback: nic, jen neuložíme odkaz
    }

    const maxPosition =
      items
        .filter((i) => !i.checked)
        .reduce((max, i) => (i.position != null && i.position > max ? i.position : max), 0) || 0;

    const { data, error } = await supabase
      .from("shopping_items")
      .insert({
        list_id: list.id,
        name,
        checked: false,
        price_info: kupiUrl,
        position: maxPosition + 1,
      })
      .select()
      .single();

    if (error) {
      alert(`Nepodařilo se přidat položku: ${error.message}`);
      return;
    }

    if (data) {
      setItems((prev) =>
        [...prev, data as ShoppingItem].sort((a, b) => {
          const fa = a.is_favorite ? 1 : 0;
          const fb = b.is_favorite ? 1 : 0;
          if (fa !== fb) return fb - fa;
          if (a.checked === b.checked) {
            const pa = a.position ?? 0;
            const pb = b.position ?? 0;
            if (pa !== pb) return pa - pb;
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          }
          return a.checked ? 1 : -1;
        })
      );
    }

    setInput("");
  }

  async function toggleItem(item: ShoppingItem) {
    const updatedChecked = !item.checked;
    await supabase
      .from("shopping_items")
      .update({ checked: updatedChecked })
      .eq("id", item.id);

    setItems((prev) =>
      [...prev]
        .map((i) => (i.id === item.id ? { ...i, checked: updatedChecked } : i))
        .sort((a, b) => {
          const fa = a.is_favorite ? 1 : 0;
          const fb = b.is_favorite ? 1 : 0;
          if (fa !== fb) return fb - fa;
          if (a.checked === b.checked) {
            const pa = a.position ?? 0;
            const pb = b.position ?? 0;
            if (pa !== pb) return pa - pb;
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          }
          return a.checked ? 1 : -1;
        })
    );
  }

  async function deleteItem(item: ShoppingItem) {
    if (!confirm(`Smazat položku „${item.name}"?`)) return;
    const { error } = await supabase.from("shopping_items").delete().eq("id", item.id);
    if (error) {
      alert(`Chyba při mazání: ${error.message}`);
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  }

  async function moveItem(item: ShoppingItem, direction: "up" | "down") {
    setItems((prev) => {
      const groupKey = `${item.is_favorite ? "fav" : "normal"}-${item.checked ? "checked" : "active"}`;
      const sameGroup = prev
        .filter((i) => `${i.is_favorite ? "fav" : "normal"}-${i.checked ? "checked" : "active"}` === groupKey)
        .sort((a, b) => {
          const pa = a.position ?? 0;
          const pb = b.position ?? 0;
          if (pa !== pb) return pa - pb;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });

      const index = sameGroup.findIndex((i) => i.id === item.id);
      if (index === -1) return prev;

      const newIndex = direction === "up" ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= sameGroup.length) return prev;

      const reordered = [...sameGroup];
      const [moved] = reordered.splice(index, 1);
      reordered.splice(newIndex, 0, moved);

      const updatedPositions: Record<string, number> = {};
      reordered.forEach((i, idx) => {
        updatedPositions[i.id] = idx + 1;
      });

      const next = prev.map((i) =>
        updatedPositions[i.id] != null ? { ...i, position: updatedPositions[i.id] } : i
      );

      void (async () => {
        await Promise.all(
          Object.entries(updatedPositions).map(([id, pos]) =>
            supabase.from("shopping_items").update({ position: pos }).eq("id", id)
          )
        );
      })();

      return next.sort((a, b) => {
        const fa = a.is_favorite ? 1 : 0;
        const fb = b.is_favorite ? 1 : 0;
        if (fa !== fb) return fb - fa;
        if (a.checked === b.checked) {
          const pa = a.position ?? 0;
          const pb = b.position ?? 0;
          if (pa !== pb) return pa - pb;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }
        return a.checked ? 1 : -1;
      });
    });
  }

  async function saveListName() {
    if (!list || !listName.trim()) return;
    await supabase.from("shopping_lists").update({ name: listName.trim() }).eq("id", list.id);
    setList({ ...list, name: listName.trim() });
    setEditingName(false);
  }

  async function archiveList() {
    if (!list) return;
    if (!confirm("Archivovat tento seznam?")) return;
    await supabase
      .from("shopping_lists")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", list.id);
    router.push("/lists");
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

  if (notFound) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6">
        <p className="text-slate-600">Seznam nenalezen</p>
        <button
          onClick={() => router.push("/lists")}
          className="mt-4 text-primary-600 underline"
        >
          Zpět na seznamy
        </button>
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
        <div className="flex-1 min-w-0">
          {editingName ? (
            <input
              type="text"
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              onBlur={saveListName}
              onKeyDown={(e) => e.key === "Enter" && saveListName()}
              className="w-full text-xl font-bold text-slate-800 bg-transparent border-b-2 border-primary-500 focus:outline-none"
              autoFocus
            />
          ) : (
            <button onClick={() => setEditingName(true)} className="text-left w-full">
              <h1 className="text-xl font-bold text-slate-800 truncate">
                {list?.name || "Seznam"}
                {list?.created_at && (
                  <span className="ml-1 text-sm font-normal text-slate-500">
                    ({formatDateShort(list.created_at)})
                  </span>
                )}
              </h1>
            </button>
          )}
          <div className="mt-1 flex flex-col gap-1">
            <button
              onClick={async () => {
                const shareToken = list?.share_token ?? null;
                const query = shareToken ? `?token=${shareToken}` : "";
                const url =
                  typeof window !== "undefined"
                    ? `${window.location.origin}/list/${hash}${query}`
                    : `/list/${hash}${query}`;
                if (typeof navigator?.share === "function") {
                  try {
                    await navigator.share({
                      title: list?.name || "Nákupní seznam",
                      url,
                    });
                    return;
                  } catch {
                    // fallback to clipboard
                  }
                }
                await navigator.clipboard?.writeText(url);
              }}
              className="text-xs text-primary-600 hover:underline text-left"
            >
              Sdílej odkaz
            </button>
            {isOwner && (
              <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <input
                  type="checkbox"
                  checked={list?.permission_level === "edit"}
                  onChange={async (e) => {
                    if (!list) return;
                    const nextPermission = e.target.checked ? "edit" : "read-only";
                    await supabase
                      .from("shopping_lists")
                      .update({ permission_level: nextPermission })
                      .eq("id", list.id);
                    const updated: ShoppingList = {
                      ...list,
                      permission_level: nextPermission as "read-only" | "edit",
                    };
                    setList(updated);
                    setCanEdit(isOwner || nextPermission === "edit");
                  }}
                  className="h-3 w-3 rounded border-slate-300"
                />
                <span>Povolit úpravy přes sdílení</span>
              </label>
            )}
          </div>
        </div>
        <button
          onClick={signOut}
          className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          Odhlásit
        </button>
      </header>

      {canEdit ? (
        <form onSubmit={addItem} className="mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Přidat položku..."
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 placeholder-slate-400 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="rounded-xl bg-primary-600 px-5 py-3 font-medium text-white shadow-lg shadow-primary-600/25 disabled:opacity-50 disabled:shadow-none"
            >
              +
            </button>
          </div>
        </form>
      ) : (
        <div className="mb-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
          Režim prohlížení
        </div>
      )}

      <ul className="flex-1 space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="group flex items-center rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
          >
            {/* Šipky řazení – horní a spodní roh */}
            {canEdit && (
              <div className="flex flex-col justify-between self-stretch py-0.5 shrink-0">
                <button
                  onClick={() => moveItem(item, "up")}
                  className="flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Přesunout nahoru"
                >
                  <svg className="h-3 w-3" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12l5-5 5 5" />
                  </svg>
                </button>
                <button
                  onClick={() => moveItem(item, "down")}
                  className="flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Přesunout dolů"
                >
                  <svg className="h-3 w-3" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 8l5 5 5-5" />
                  </svg>
                </button>
              </div>
            )}
            {/* 1. Radiobutton (bought) */}
            {canEdit && (
              <button
                onClick={() => toggleItem(item)}
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
                  item.checked
                    ? "border-primary-500 bg-primary-500 text-white"
                    : "border-slate-300"
                }`}
                aria-label={item.checked ? "Označit jako nenakoupené" : "Označit jako nakoupené"}
              >
                {item.checked && (
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            )}
            {/* 2. Hvězdička (oblíbené) */}
            {canEdit && (
              <button
                onClick={async () => {
                  const next = !item.is_favorite;
                  await supabase
                    .from("shopping_items")
                    .update({ is_favorite: next })
                    .eq("id", item.id);
                  setItems((prev) =>
                    [...prev]
                      .map((i) => (i.id === item.id ? { ...i, is_favorite: next } : i))
                      .sort((a, b) => {
                        const fa = a.is_favorite ? 1 : 0;
                        const fb = b.is_favorite ? 1 : 0;
                        if (fa !== fb) return fb - fa;
                        if (a.checked === b.checked) {
                          const pa = a.position ?? 0;
                          const pb = b.position ?? 0;
                          if (pa !== pb) return pa - pb;
                          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                        }
                        return a.checked ? 1 : -1;
                      })
                  );
                }}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-transparent text-yellow-400 hover:text-yellow-500"
                aria-label={item.is_favorite ? "Odebrat z oblíbených" : "Přidat do oblíbených"}
              >
                {item.is_favorite ? (
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.073 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.802 2.036a1 1 0 00-.364 1.118l1.073 3.292c.3.921-.755 1.688-1.54 1.118l-2.802-2.036a1 1 0 00-1.175 0L6.76 16.183c-.784.57-1.838-.197-1.539-1.118l1.073-3.292a1 1 0 00-.364-1.118L3.128 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.073-3.292z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.163c.969 0 1.371 1.24.588 1.81l-3.37 2.449a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.449a1 1 0 00-1.175 0l-3.37 2.449c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.962 9.384c-.783-.57-.38-1.81.588-1.81h4.163a1 1 0 00.951-.69l1.286-3.957z" />
                  </svg>
                )}
              </button>
            )}
            {/* 3. Název + pod ním datum, cena, Kupi */}
            <div className="flex-1 min-w-0 flex flex-col justify-center gap-0">
  
              {/* 1. ŘÁDEK: Název položky a čas */}
              <div className="flex items-baseline gap-x-2">
                <div className={`font-medium text-slate-800 ${item.checked ? "line-through text-slate-500" : ""}`}>
                  {item.name}
                </div>
                <div className="text-[10px] text-slate-400">
                  {formatDateTime(item.created_at)}
                </div>
              </div>

              {/* 2. ŘÁDEK: Akce na Kupi a cena */}
              <div className="flex items-center gap-x-2 text-xs">
                {item.price_info && (
                  <a
                    href={item.price_info}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:underline font-medium"
                  >
                    Akce na Kupi.cz
                  </a>
                )}
                
                {minPrices[item.id] !== undefined && (
                  <span className="text-slate-500">
                    od <span className="font-semibold text-slate-800">
                      {formatCzk(minPrices[item.id].value)} Kč{minPrices[item.id].unit ? `/${minPrices[item.id].unit}` : ""}
                    </span>
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => setPriceModalItem(item)}
              className={`rounded p-1.5 transition hover:bg-slate-100 ${
                minPrices[item.id] !== undefined ? "text-primary-600" : "text-slate-400 hover:text-slate-600"
              }`}
              aria-label="Ceny v obchodech"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </button>
            {canEdit && (
              <button
                onClick={() => deleteItem(item)}
                className="rounded p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                aria-label="Smazat"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </li>
        ))}
      </ul>

      {items.length === 0 && (
        <p className="py-8 text-center text-slate-500">Žádné položky. Přidejte první!</p>
      )}

      <div className="mt-6 flex gap-2">
        <button
          onClick={archiveList}
          className="flex-1 rounded-xl border border-slate-200 py-3 text-sm text-slate-600 hover:bg-slate-50"
        >
          Archivovat
        </button>
      </div>

      {priceModalItem && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-50">
          <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
            <button
              onClick={() => setPriceModalItem(null)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
              aria-label="Zavřít"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-lg font-semibold text-slate-800 truncate">
              Ceny – {priceModalItem.name}
            </h2>
          </header>

          <div className="mx-auto flex w-full max-w-md flex-1 flex-col overflow-auto px-4 py-6">
            <form onSubmit={addPriceEntry} className="mb-6 flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Název obchodu
                </label>
                <select
                  value={priceStore}
                  onChange={(e) => setPriceStore(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800"
                >
                  <option value="">Vyber obchod…</option>
                  <option value="Albert HM">Albert HM</option>
                  <option value="Albert SM">Albert SM</option>
                  <option value="Billa">Billa</option>
                  <option value="Globus">Globus</option>
                  <option value="Kaufland">Kaufland</option>
                  <option value="Košík">Košík</option>
                  <option value="Lidl">Lidl</option>
                  <option value="Penny">Penny</option>
                  <option value="Tesco">Tesco</option>
                  <option value="Ostatní">Ostatní</option>
                </select>
              </div>
              <input
                type="text"
                inputMode="decimal"
                value={priceValue}
                onChange={(e) => setPriceValue(e.target.value)}
                placeholder="Cena v Kč"
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 placeholder-slate-400"
              />
              <input
                type="text"
                inputMode="decimal"
                value={priceQuantity}
                onChange={(e) => setPriceQuantity(e.target.value)}
                placeholder="Množství: počet, kg (výchozí 1)"
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 placeholder-slate-400"
              />
              <button
                type="submit"
                disabled={!priceStore.trim()}
                className="rounded-xl bg-primary-600 py-3 font-medium text-white disabled:opacity-50"
              >
                Přidat
              </button>
            </form>

            <div className="space-y-2">
              {prices.length === 0 ? (
                <p className="py-4 text-center text-slate-500">Žádné ceny. Přidejte první.</p>
              ) : (
                prices.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-slate-800">{p.store_name}</span>
                      <span className="ml-2 text-slate-500 text-sm">
                        {Number(p.quantity) !== 1 || p.quantity_unit
                          ? `× ${p.quantity}${p.quantity_unit ? ` ${p.quantity_unit}` : ""}`
                          : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-primary-600 font-semibold">
                        {p.price} Kč
                        {Number(p.quantity) !== 1 && (
                          <span className="ml-1 font-normal text-slate-500">
                            →
                            {` ${Number(p.unit_price ?? p.price)} Kč/${p.quantity_unit || "ks"}`}
                          </span>
                        )}
                      </span>
                      <button
                        onClick={() => deletePriceEntry(p)}
                        className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                        aria-label="Smazat"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
