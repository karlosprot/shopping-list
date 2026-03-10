import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Vercel Cron: add to vercel.json:
// { "crons": [{ "path": "/api/cron/archive", "schedule": "0 2 * * *" }] }
// Runs daily at 2 AM UTC

export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret") || request.headers.get("authorization")?.replace("Bearer ", "");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase.rpc("auto_archive_old_lists");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
