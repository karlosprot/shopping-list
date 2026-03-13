import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

export type ShoppingList = {
  id: string;
  hash: string;
  name: string;
  created_at: string;
  archived_at: string | null;
  last_modified_at?: string | null;
  owner_email?: string | null;
  share_token?: string | null;
  permission_level?: "read-only" | "edit" | null;
  is_favorite?: boolean | null;
};

export type listsAccess = {
  id: string;
  list_id: string;
  user_email: string;
  permission_level: "owner" | "read-only" | "edit";
  share_token: string | null;
  position: number;
  is_favorite: boolean;
};

// Kombinovaný typ pro dashboard
export type UserListDashboardItem = listsAccess & {
  shopping_lists: {
    name: string;
    hash: string;
    owner_email: string | null; // Nyní taháme odsud    
    archived_at: string | null;
    created_at: string;
  } | null;
};

export type ShoppingItem = {
  id: string;
  list_id: string;
  name: string;
  checked: boolean;
  price_info: string | null;
  created_at: string;
  position?: number | null;
  is_favorite?: boolean | null;
};

export type ItemPrice = {
  id: string;
  item_id: string;
  store_name: string;
  price: number;
  quantity: number;
  quantity_unit: string | null;
  unit_price: number;
  created_at: string;
};
