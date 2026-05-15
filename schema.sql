-- ═══════════════════════════════════════════════════════
-- Open Azitfh — Supabase Schema
-- 여러 번 실행해도 안전합니다.
-- ═══════════════════════════════════════════════════════

-- ── 1. Tables ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.posts (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT        NOT NULL,
  content          TEXT        NOT NULL,
  category         TEXT        NOT NULL DEFAULT '',
  author_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_nickname  TEXT        NOT NULL DEFAULT '익명',
  views            INTEGER     NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.categories (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL UNIQUE,
  description  TEXT        NOT NULL DEFAULT '',
  created_by   TEXT        NOT NULL DEFAULT '익명',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notices (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT        NOT NULL,
  date        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2. Row Level Security ────────────────────────────

ALTER TABLE public.posts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices    ENABLE ROW LEVEL SECURITY;

-- posts
DROP POLICY IF EXISTS "posts_select" ON public.posts;
CREATE POLICY "posts_select" ON public.posts
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "posts_insert" ON public.posts;
CREATE POLICY "posts_insert" ON public.posts
  FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "posts_update" ON public.posts;
CREATE POLICY "posts_update" ON public.posts
  FOR UPDATE USING (auth.uid() = author_id);

DROP POLICY IF EXISTS "posts_delete" ON public.posts;
CREATE POLICY "posts_delete" ON public.posts
  FOR DELETE USING (auth.uid() = author_id);

-- categories
DROP POLICY IF EXISTS "categories_select" ON public.categories;
CREATE POLICY "categories_select" ON public.categories
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "categories_insert" ON public.categories;
CREATE POLICY "categories_insert" ON public.categories
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "categories_delete" ON public.categories;
CREATE POLICY "categories_delete" ON public.categories
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- notices
DROP POLICY IF EXISTS "notices_select" ON public.notices;
CREATE POLICY "notices_select" ON public.notices
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "notices_insert" ON public.notices;
CREATE POLICY "notices_insert" ON public.notices
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "notices_delete" ON public.notices;
CREATE POLICY "notices_delete" ON public.notices
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ── 3. Database Functions ────────────────────────────

CREATE OR REPLACE FUNCTION increment_views(post_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.posts SET views = views + 1 WHERE id = post_id;
$$;

-- ── 4. Seed Data ─────────────────────────────────────

INSERT INTO public.categories (name, description, created_by)
VALUES ('공부아지트', '공부 관련 게시물을 올리는 공간이에요.', '시스템')
ON CONFLICT (name) DO NOTHING;
