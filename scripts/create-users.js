/* eslint-disable no-console */

/**
 * Create initial Supabase Auth users.
 *
 * Usage (PowerShell):
 *  $env:SUPABASE_SERVICE_ROLE_KEY="..."
 *  $env:USER_PASSWORD="Emilka.2714"
 *  node scripts/create-users.js
 */

(async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const password = process.env.USER_PASSWORD;

  if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  if (!password) throw new Error("Missing USER_PASSWORD");

  const { createClient } = await import("@supabase/supabase-js");
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const users = ["karloprot@gmail.com", "eliska.hoffmannova@gmail.com"];

  for (const email of users) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) {
      console.error(`[FAIL] ${email}: ${error.message}`);
      continue;
    }
    console.log(`[OK] ${email}: ${data.user?.id || "created"}`);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

