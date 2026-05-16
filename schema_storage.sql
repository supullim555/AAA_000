-- ═══════════════════════════════════════════════════════
-- Open Azitfh — Supabase Storage 설정
-- ═══════════════════════════════════════════════════════
-- 1단계: Supabase 대시보드 → Storage → New bucket
--         이름: post-media  /  Public: ON
--
-- 2단계: 아래 SQL을 SQL Editor에서 실행
-- ═══════════════════════════════════════════════════════

-- 공개 읽기
CREATE POLICY "Public read post-media"
ON storage.objects FOR SELECT
USING (bucket_id = 'post-media');

-- 로그인 사용자만 업로드
CREATE POLICY "Auth upload post-media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'post-media' AND auth.uid() IS NOT NULL);

-- 본인이 올린 파일만 삭제 가능
CREATE POLICY "Owner delete post-media"
ON storage.objects FOR DELETE
USING (bucket_id = 'post-media' AND auth.uid() = owner);
