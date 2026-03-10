# Nákupní seznam – PWA

Sdílený nákupní seznam v reálném čase. PWA v Next.js s Tailwind CSS a Supabase.

## Funkce

- **Více seznamů** – vytváření a přepínání mezi seznamy v menu
- **Unikátní URL** – každý seznam má vlastní odkaz s hashem (např. `/list/abc123xyz`)
- **Reálný čas** – Supabase Realtime pro synchronizaci mezi více uživateli
- **Archivace** – ruční archivace nebo automatická po 1 měsíci
- **Mobilní design** – jednoduché rozhraní s inputem a seznamem položek

## Nastavení

### 1. Supabase

1. Vytvořte projekt na [supabase.com](https://supabase.com)
2. V **SQL Editor** spusťte migraci `supabase/migrations/001_initial_schema.sql`
3. V **Database → Replication** povolte Realtime pro tabulky `shopping_lists` a `shopping_items`
4. Zkopírujte URL a anon key z **Settings → API**

### 2. Proměnné prostředí

Vytvořte `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Pro automatickou archivaci (Vercel Cron) přidejte:

```
CRON_SECRET=nahodny-tajny-retezec
SUPABASE_SERVICE_ROLE_KEY=service-role-key-z-supabase
```

### 3. Instalace a spuštění

```bash
npm install
node scripts/generate-icons.js   # vytvoří PWA ikony
npm run dev
```

Aplikace běží na [http://localhost:3000](http://localhost:3000).

### 4. Automatická archivace

Funkce `auto_archive_old_lists()` archivuje seznamy starší 1 měsíce. Na Vercelu se volá denně přes cron (`vercel.json`). Nastavte `CRON_SECRET` v Vercel a přidejte ho do hlavičky cron jobu.

## Struktura

- `/lists` – přehled seznamů, vytvoření nového
- `/list/[hash]` – konkrétní seznam (sdílený odkaz)
- `/archive` – archivované seznamy

## PWA

Aplikace je PWA – lze ji nainstalovat na mobil. Ikony jsou v `public/icon-192.png` a `public/icon-512.png` (vygenerované skriptem).
