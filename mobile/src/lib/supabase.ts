import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://lbfxonyshkxdbnhmnvxq.supabase.co';

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxiZnhvbnlzaGt4ZGJuaG1udnhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4OTA0OTcsImV4cCI6MjEwMjQ2NjQ5N30.SWYryZq84bdFAx-mQyeT68SPmCXh_V0qHghXelQWzE4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
