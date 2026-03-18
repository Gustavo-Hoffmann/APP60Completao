import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Faltam VITE_SUPABASE_URL e/ou VITE_SUPABASE_ANON_KEY no .env");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);