// ── Supabase 초기화 ──
// Supabase 대시보드 → Project Settings → API 에서 값을 확인하세요.
const SUPABASE_URL      = 'https://ywyzcyvlfafmwoxjxmck.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_y7y5eFDZ3N2YDJsTL5RZ2g_b-Y91W7k';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
