// Supabase 설정 예시 파일
// 이 파일을 복사해서 supabase-config.js 로 이름 바꾼 후 실제 값 입력
// supabase.com/dashboard → Project Settings → API

const SUPABASE_URL      = 'https://YOUR_PROJECT_REF.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
