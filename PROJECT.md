# Open Azitfh — 프로젝트 문서

> 한국어 커뮤니티 사이트. 바닐라 JS + Supabase 기반 정적 사이트.

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [기술 스택 & 환경](#2-기술-스택--환경)
3. [파일 구조](#3-파일-구조)
4. [데이터베이스 스키마](#4-데이터베이스-스키마)
5. [페이지 구조](#5-페이지-구조)
6. [app.js 함수 레퍼런스](#6-appjs-함수-레퍼런스)
7. [admin.js 함수 레퍼런스](#7-adminjs-함수-레퍼런스)
8. [CSS 클래스 레퍼런스](#8-css-클래스-레퍼런스)
9. [RLS 보안 정책](#9-rls-보안-정책)
10. [DB 함수 (SECURITY DEFINER)](#10-db-함수-security-definer)
11. [배포 & 환경 설정](#11-배포--환경-설정)

---

## 1. 프로젝트 개요

| 항목 | 내용 |
|---|---|
| 프로젝트명 | Open Azitfh |
| 목적 | 로그인 기반 게시판 커뮤니티 |
| 빌드 | 없음 (정적 HTML/CSS/JS) |
| 인증 | Supabase Auth (이메일/비밀번호) |
| DB | Supabase PostgreSQL |
| 배포 | Vercel (GitHub 자동 배포) |

**핵심 기능**
- 카테고리별 게시판 (작성자만 삭제)
- 댓글 / 추천·비추천
- 신고 → 30% 임계값 초과 시 자동 숨김
- 운영자 패널 (숨김 게시물 복원, 관리자 추가, 공지 관리)
- 다크모드 기본값 (localStorage 유지, FOUC 방지)
- 아이디·비밀번호 찾기 / 재설정

---

## 2. 기술 스택 & 환경

```
Frontend   Vanilla JS (ES2020+) · HTML5 · CSS3 (CSS Variables)
Backend    Supabase (PostgreSQL + Auth + PostgREST)
Hosting    Vercel
```

**외부 의존성 (CDN)**
```html
https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2
```

**환경 변수** (`supabase-config.js`)
```js
const SUPABASE_URL      = 'https://<project>.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_...';
```

---

## 3. 파일 구조

```
FFS/
├── index.html            홈 (카테고리·게시물 목록)
├── login.html            로그인
├── signup.html           회원가입
├── forgot.html           아이디·비밀번호 찾기
├── reset-password.html   비밀번호 재설정 콜백
├── post-write.html       글쓰기
├── post-detail.html      게시물 상세 (댓글·투표·신고)
├── dashboard.html        내 공간 (카테고리 관리·글쓰기)
├── admin.html            운영자 패널
│
├── app.js                메인 앱 로직 (모든 페이지 공유)
├── admin.js              운영자 패널 전용 로직
├── supabase-config.js    Supabase 클라이언트 초기화
│
├── style.css             전체 스타일 (라이트·다크 모드)
│
├── schema.sql                  DB 기본 테이블 & RLS
├── schema_reports.sql          신고·관리자 테이블 & 함수
├── schema_comments_votes.sql   댓글·투표 테이블 & 함수
│
├── logo.png              로고 이미지 (hero-gen으로 생성)
├── CLAUDE.md             Claude Code 가이드
└── PROJECT.md            ← 이 파일
```

---

## 4. 데이터베이스 스키마

### 4-1. posts

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | UUID PK | gen_random_uuid() |
| `title` | TEXT NOT NULL | 제목 |
| `content` | TEXT NOT NULL | 본문 |
| `category` | TEXT NOT NULL DEFAULT '' | 카테고리 이름 |
| `author_id` | UUID FK → auth.users | 작성자 |
| `author_nickname` | TEXT NOT NULL | 닉네임 스냅샷 |
| `views` | INTEGER DEFAULT 0 | 조회수 |
| `hidden` | BOOLEAN DEFAULT false | 신고 임계값 초과 시 true |
| `created_at` | TIMESTAMPTZ DEFAULT now() | |

### 4-2. categories

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | UUID PK | |
| `name` | TEXT NOT NULL UNIQUE | 카테고리 이름 |
| `description` | TEXT DEFAULT '' | 설명 |
| `created_by` | TEXT DEFAULT '익명' | 작성자 닉네임 |
| `creator_id` | UUID FK → auth.users | 작성자 UUID (소유권) |
| `created_at` | TIMESTAMPTZ DEFAULT now() | |

### 4-3. notices

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | UUID PK | |
| `title` | TEXT NOT NULL | 공지 내용 |
| `date` | TEXT NOT NULL | 표시 날짜 (ko-KR) |
| `created_at` | TIMESTAMPTZ DEFAULT now() | |

### 4-4. reports

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | UUID PK | |
| `post_id` | UUID FK → posts | |
| `reporter_id` | UUID FK → auth.users | |
| `reason` | TEXT DEFAULT '기타' | 신고 사유 |
| `created_at` | TIMESTAMPTZ | |
| **UNIQUE** | (post_id, reporter_id) | 중복 신고 방지 |

### 4-5. admins

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `user_id` | UUID PK FK → auth.users | |
| `email` | TEXT NOT NULL | |
| `granted_at` | TIMESTAMPTZ DEFAULT now() | |

### 4-6. comments

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | UUID PK | |
| `post_id` | UUID FK → posts | |
| `author_id` | UUID FK → auth.users | |
| `author_nickname` | TEXT NOT NULL | |
| `content` | TEXT NOT NULL | 최대 500자 |
| `created_at` | TIMESTAMPTZ DEFAULT now() | |

### 4-7. votes

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | UUID PK | |
| `post_id` | UUID FK → posts | |
| `user_id` | UUID FK → auth.users | |
| `vote_type` | TEXT CHECK ('up'\|'down') | |
| `created_at` | TIMESTAMPTZ | |
| **UNIQUE** | (post_id, user_id) | 1인 1표 |

---

## 5. 페이지 구조

| 파일 | 진입점 함수 | 로그인 필요 |
|---|---|---|
| `index.html` | `initIndex()` | 선택 (쓰기는 필요) |
| `login.html` | `initLogin()` | ✗ |
| `signup.html` | `initSignup()` | ✗ |
| `forgot.html` | `initForgot()` | ✗ |
| `reset-password.html` | `initResetPassword()` | ✗ (토큰 기반) |
| `post-write.html` | `initPostWrite()` | ✅ |
| `post-detail.html` | `initPostDetail()` | 선택 (댓글·투표는 필요) |
| `dashboard.html` | `initDashboard()` | ✅ |
| `admin.html` | `initAdminPanel()` | ✅ + 어드민 |

**모든 페이지 공통 호출**
```html
<script>initDarkMode(); init페이지();</script>
```

---

## 6. app.js 함수 레퍼런스

### 다크모드

| 함수 | 설명 |
|---|---|
| `initDarkMode()` | localStorage 읽어 다크모드 적용, 토글 리스너 설정 |
| `updateToggleIcon()` | 다크=🌙 / 라이트=☀️ 버튼 업데이트 |

### UI 헬퍼

| 함수 | 설명 |
|---|---|
| `showToast(msg, type)` | 3초 토스트 알림. type: `''`\|`'green'`\|`'red'` |
| `showError(id, msg)` | 지정 요소에 에러 메시지 표시 |
| `clearErrors()` | 페이지 전체 에러 메시지 숨김 |
| `setLoading(btn, loading)` | 버튼 disabled + 텍스트 '처리 중...' 전환 |
| `escapeHTML(s)` | XSS 방지 HTML 이스케이프 (`& < > " '`) |
| `truncate(s, n)` | n자 초과 시 `…` 처리 |
| `formatDate(iso)` | ISO → `YYYY. M. D.` 한국식 변환 |

### 인증

| 함수 | 설명 |
|---|---|
| `authSignUp(email, pw, nickname)` | Supabase 회원가입 |
| `authSignIn(email, pw)` | Supabase 로그인 |
| `authSignOut()` | Supabase 로그아웃 |
| `getSession()` | 현재 세션 반환 (null = 비로그인) |
| `requireAuth()` | 세션 없으면 login.html 리다이렉트, 있으면 session 반환 |
| `updateNav(session)` | 로그인 상태에 따라 헤더 nav 표시/숨김 |
| `toKoreanError(err)` | Supabase 에러 → 한국어 메시지 |
| `isAdmin()` | 현재 유저가 admins 테이블에 있는지 확인 |

### 계정 찾기

| 함수 | 설명 |
|---|---|
| `findEmailByNickname(nickname)` | RPC: 닉네임 → 마스킹 이메일 |
| `sendPasswordReset(email)` | Supabase 재설정 이메일 발송 |
| `updatePassword(newPassword)` | Supabase 비밀번호 변경 |

### 공지사항

| 함수 | 설명 |
|---|---|
| `getNotices()` | 공지 목록 조회 (최신순) |
| `insertNotice({title, date})` | 공지 추가 (어드민만 RLS) |
| `deleteNotice(id)` | 공지 삭제 |
| `renderNotices(isAdmin)` | 공지 카드 렌더링 |
| `initNotices(isAdmin)` | 공지 폼 초기화 |

### 카테고리

| 함수 | 설명 |
|---|---|
| `getCategories()` | 카테고리 목록 조회 (created_at 오름차순) |
| `getCategoryNames()` | 이름만 string[] 반환 |
| `insertCategory({name, description, created_by, creator_id})` | 카테고리 추가 |
| `deleteCategory(name)` | 카테고리 삭제 |
| `getCatCounts(posts)` | 카테고리별 게시물 수 `{name: count}` |
| `getCatUserCounts(posts)` | 카테고리별 고유 작성자 수 `{name: count}` |
| `renderCategoryCards()` | 홈 카테고리 카드 렌더링 (인기순, HOT 배지) |
| `updateWriteBtn()` | 선택된 카테고리를 글쓰기 URL `?cat=` 에 반영 |
| `initCategorySection()` | 홈 카테고리 섹션 초기화 |
| `renderCategories(userId)` | 대시보드: 내 카테고리 목록 렌더링 |
| `initCategoryManager(userId, nickname)` | 대시보드 카테고리 추가/삭제 폼 초기화 |

### 게시물

| 함수 | 설명 |
|---|---|
| `getPosts(categoryFilter)` | 게시물 조회. 필터 없으면 전체 |
| `getPost(id)` | 단일 게시물 조회 |
| `insertPost(postData)` | 게시물 작성 |
| `deletePost(id)` | 게시물 삭제 |
| `incrementViews(id)` | RPC: 조회수 원자적 +1 |
| `renderPosts()` | 인기 게시물 카드 렌더링 (조회수순, 최대 `CONFIG.POPULAR_LIMIT`개) |
| `renderPostsList()` | 전체 게시물 목록 렌더링 (최신순) |

### 투표

| 함수 | 설명 |
|---|---|
| `getVoteCounts(postId)` | `{up, down}` 반환 |
| `getMyVote(postId, userId)` | `'up'` \| `'down'` \| `null` |
| `castVote(postId, voteType, userId)` | 투표 추가·변경·취소 (토글) |
| `initVotes(postId, session)` | 투표 버튼 초기화 및 리스너 설정 |

### 신고

| 함수 | 설명 |
|---|---|
| `reportPost(postId, reason)` | RPC `submit_report` 호출 |
| `hasReported(postId)` | 이미 신고했는지 확인 |
| `initReportModal(postId)` | 신고 사유 모달 초기화 |

### 댓글

| 함수 | 설명 |
|---|---|
| `getComments(postId)` | 댓글 목록 조회 (오래된순) |
| `insertComment({post_id, author_id, author_nickname, content})` | 댓글 추가 |
| `deleteComment(id)` | 댓글 삭제 |
| `renderComments(postId, session)` | 댓글 목록 렌더링 |
| `initComments(postId, session)` | 댓글 폼 초기화 (500자 카운터) |

### 페이지 초기화

| 함수 | 페이지 | 설명 |
|---|---|---|
| `initIndex()` | index.html | 카테고리·게시물·공지 로드 |
| `initPostWrite()` | post-write.html | 카테고리 로드, 게시물 제출 |
| `initPostDetail()` | post-detail.html | 게시물·투표·신고·댓글 |
| `initDashboard()` | dashboard.html | 사용자 정보·카테고리 관리 |
| `initLogin()` | login.html | 로그인 폼 |
| `initSignup()` | signup.html | 회원가입 폼 (유효성 검사) |
| `initForgot()` | forgot.html | 아이디·비밀번호 찾기 탭 |
| `initResetPassword()` | reset-password.html | PASSWORD_RECOVERY 콜백 |

---

## 7. admin.js 함수 레퍼런스

| 함수 | 설명 |
|---|---|
| `initAdminPanel()` | 어드민 권한 확인 후 패널 렌더링 |
| `initTabs()` | 탭(신고된 게시물·관리자·공지) 전환 |
| `loadReportedPosts()` | `hidden=true` 게시물 + 신고 수 표시 |
| `doUnhide(postId)` | RPC: 게시물 복원 + 신고 초기화 |
| `doAdminDelete(postId)` | RPC: 게시물 영구 삭제 |
| `checkEmpty(containerId, msg)` | 컨테이너가 비면 안내 메시지 표시 |
| `loadAdmins()` | 관리자 목록 표시 (본인 제외 제거 버튼) |
| `doAddAdmin()` | RPC: 이메일로 관리자 추가 |
| `doRemoveAdmin(userId)` | RPC: 관리자 제거 |
| `loadNoticesAdmin()` | 공지 목록 + 삭제 버튼 |
| `doAddNoticeAdmin()` | app.js의 `insertNotice` 호출 |
| `doDeleteNoticeAdmin(id)` | app.js의 `deleteNotice` 호출 |

---

## 8. CSS 클래스 레퍼런스

### 레이아웃

| 클래스 | 설명 |
|---|---|
| `.post-wrap` | 게시물 상세/작성 컨테이너 (max-width: 740px) |
| `.dash-wrap` | 대시보드 컨테이너 (max-width: 900px) |
| `.admin-wrap` | 어드민 컨테이너 (max-width: 900px) |
| `.auth-wrap` / `.auth-box` | 인증 페이지 중앙 카드 |
| `.news-section` | 홈 게시물 섹션 (max-width: 980px) |
| `.cat-section` / `.cat-box` | 홈 카테고리 박스 (둥근 모서리 카드) |

### 게시물 카드

| 클래스 | 설명 |
|---|---|
| `.news-card` | 게시물 카드 (링크) |
| `.news-card-top` | 카드 상단 (배지 + 날짜) |
| `.news-badge` | 카테고리 배지 |
| `.news-title` | 게시물 제목 |
| `.news-desc` | 게시물 미리보기 |
| `.news-empty` | 빈 상태 메시지 |
| `.post-row` | 게시물 목록 행 |
| `.post-row-cat/title/author/date/views` | 행 내 각 셀 |

### 카테고리

| 클래스 | 설명 |
|---|---|
| `.cat-card-btn` | 카테고리 버튼 카드 |
| `.cat-card-btn.active-up` / `.active-down` | 활성 상태 |
| `.cat-hot-badge` | HOT 배지 (주황) |
| `.cat-chip` | 대시보드용 칩 (chips 모드) |
| `.cat-item` / `.cat-name` / `.cat-del` | 카테고리 관리 목록 행 |

### 투표·댓글·신고

| 클래스 | 설명 |
|---|---|
| `.vote-section` | 투표 버튼 컨테이너 |
| `.vote-btn` | 추천/비추천 버튼 |
| `.vote-btn.active-up` / `.active-down` | 활성 투표 상태 |
| `.comment-section` | 댓글 전체 영역 |
| `.comment-item` | 댓글 행 |
| `.comment-form` | 댓글 입력 폼 |
| `.modal-overlay` | 신고 모달 오버레이 |
| `.modal-box` | 신고 모달 카드 |
| `.report-reason-item` | 신고 사유 라디오 항목 |

### 어드민

| 클래스 | 설명 |
|---|---|
| `.admin-tabs` / `.admin-tab` | 어드민 탭 바 |
| `.admin-section` | 탭 콘텐츠 영역 |
| `.admin-card` | 어드민 카드 (게시물/관리자/공지) |
| `.admin-btn-restore` | 복원 버튼 (초록) |
| `.admin-btn-delete` | 삭제 버튼 (빨강) |
| `.admin-badge-hidden` | 숨김 상태 배지 |

### 공통

| 클래스 | 설명 |
|---|---|
| `.hidden` | `display: none !important` |
| `.toast` / `.toast.show` | 알림 메시지 |
| `.btn` / `.btn-primary` / `.btn-outline` | 버튼 변형 |
| `.field` / `.field label` | 폼 필드 |
| `.error-msg.show` / `.global-error.show` | 에러 표시 |

### CSS 변수 (라이트 모드 기본값)

```css
--primary:      #4aab8e   /* 메인 녹색 */
--primary-dark: #368f75
--accent:       #f5a623   /* 주황 (HOT, 로고) */
--bg:           #f6f6f3
--card:         #ffffff
--text:         #1c1c2e
--text-light:   #6b7280
--border:       #e8e8e4
--r:    14px              /* 기본 border-radius */
--r-sm: 8px
```

---

## 9. RLS 보안 정책

| 테이블 | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| posts | `hidden=false` 또는 어드민 | `auth.uid()=author_id` | `auth.uid()=author_id` | `auth.uid()=author_id` |
| categories | 전체 | 로그인 유저 | — | `creator_id=auth.uid()` |
| notices | 전체 | 어드민만 | — | 어드민만 |
| reports | 본인 신고 또는 어드민 | `auth.uid()=reporter_id` | — | — |
| admins | 전체 | 함수만 (정책 없음) | — | 함수만 |
| comments | 전체 | `auth.uid()=author_id` | — | `auth.uid()=author_id` |
| votes | 전체 | `auth.uid()=user_id` | `auth.uid()=user_id` | `auth.uid()=user_id` |

---

## 10. DB 함수 (SECURITY DEFINER)

| 함수 | 인자 | 반환 | 설명 |
|---|---|---|---|
| `increment_views(post_id)` | UUID | void | 조회수 원자적 +1 |
| `submit_report(p_post_id, p_reason)` | UUID, TEXT | jsonb | 신고 제출 + 30% 임계값 자동 숨김 |
| `unhide_post(p_post_id)` | UUID | void | 게시물 복원 + 신고 초기화 (어드민) |
| `admin_delete_post(p_post_id)` | UUID | void | 게시물 영구 삭제 (어드민) |
| `add_admin_by_email(target_email)` | TEXT | jsonb | 이메일로 관리자 추가 (어드민) |
| `remove_admin(target_user_id)` | UUID | void | 관리자 제거, 마지막 1명 방지 (어드민) |
| `find_email_by_nickname(target_nickname)` | TEXT | TEXT | 닉네임 → 마스킹 이메일 반환 |

**신고 자동 숨김 조건** (`submit_report`):
```
신고 수 >= 3건
AND 신고 수 / 카테고리 고유 작성자 수 >= 0.3 (30%)
```

---

## 11. 배포 & 환경 설정

### Supabase 설정 순서

```
1. schema.sql              기본 테이블 + RLS + 조회수 함수
2. schema_reports.sql      신고·어드민 테이블 + 함수
3. schema_comments_votes.sql  댓글·투표 테이블 + 함수 업데이트
4. 첫 번째 관리자 등록:
   INSERT INTO public.admins (user_id, email)
   SELECT id, email FROM auth.users WHERE email = 'your@email.com';
5. Authentication > URL Configuration
   - Site URL: https://your-domain.vercel.app
   - Redirect URLs에 추가: https://your-domain.vercel.app/reset-password.html
```

### Vercel 배포

```
Framework Preset: Other
Build Command:    (없음)
Output Directory: (없음 또는 .)
```

GitHub에 push하면 자동 재배포됩니다.

### 첫 번째 관리자 find_email_by_nickname SQL (선택)

```sql
CREATE OR REPLACE FUNCTION find_email_by_nickname(target_nickname TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_email TEXT;
BEGIN
  SELECT email INTO v_email FROM auth.users
  WHERE raw_user_meta_data->>'nickname' = target_nickname LIMIT 1;
  IF v_email IS NULL THEN RETURN NULL; END IF;
  RETURN LEFT(v_email, 3) || '***@' || SPLIT_PART(v_email, '@', 2);
END;
$$;
```

---

*최종 업데이트: 2026-05-15*
