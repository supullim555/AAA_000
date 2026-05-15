-- ═══════════════════════════════════════════════════════
-- Open Azitfh — Comments & Votes Migration
-- Supabase SQL Editor에서 실행하세요.
-- ═══════════════════════════════════════════════════════

-- ── 1. reports 테이블에 reason 컬럼 추가 ─────────────

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT '기타';

-- ── 2. 댓글 테이블 ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.comments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id         UUID        NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_nickname TEXT        NOT NULL DEFAULT '익명',
  content         TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comments_select" ON public.comments;
CREATE POLICY "comments_select" ON public.comments
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "comments_insert" ON public.comments;
CREATE POLICY "comments_insert" ON public.comments
  FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "comments_delete" ON public.comments;
CREATE POLICY "comments_delete" ON public.comments
  FOR DELETE USING (auth.uid() = author_id);

-- ── 3. 추천/비추천 테이블 ────────────────────────────

CREATE TABLE IF NOT EXISTS public.votes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID        NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote_type   TEXT        NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)   -- 유저당 게시물 1표만
);

ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "votes_select" ON public.votes;
CREATE POLICY "votes_select" ON public.votes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "votes_insert" ON public.votes;
CREATE POLICY "votes_insert" ON public.votes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "votes_update" ON public.votes;
CREATE POLICY "votes_update" ON public.votes
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "votes_delete" ON public.votes;
CREATE POLICY "votes_delete" ON public.votes
  FOR DELETE USING (auth.uid() = user_id);

-- ── 4. submit_report 함수 업데이트 (reason 파라미터) ─

CREATE OR REPLACE FUNCTION submit_report(p_post_id UUID, p_reason TEXT DEFAULT '기타')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_category       TEXT;
  v_category_users INTEGER;
  v_report_count   INTEGER;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.reports
    WHERE post_id = p_post_id AND reporter_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_reported');
  END IF;

  SELECT category INTO v_category FROM public.posts WHERE id = p_post_id;
  INSERT INTO public.reports (post_id, reporter_id, reason)
  VALUES (p_post_id, auth.uid(), p_reason);

  SELECT COUNT(DISTINCT author_id) INTO v_category_users
  FROM public.posts WHERE category = v_category;

  SELECT COUNT(*) INTO v_report_count FROM public.reports WHERE post_id = p_post_id;

  IF v_category_users > 0
     AND v_report_count >= 3
     AND v_report_count::float / v_category_users >= 0.3
  THEN
    UPDATE public.posts SET hidden = true WHERE id = p_post_id;
    RETURN jsonb_build_object('success', true, 'hidden', true);
  END IF;

  RETURN jsonb_build_object('success', true, 'hidden', false, 'report_count', v_report_count);
END;
$$;
