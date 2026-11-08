"use client";
import { createClient } from "@supabase/supabase-js";
// One Auth instance across browser screens, including recovery and account changes.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);
