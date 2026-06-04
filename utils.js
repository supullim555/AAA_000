/**
 * utils.js — Open Azitfh 공통 유틸리티
 * app.js보다 먼저 로드. 페이지 로직 없음 — 순수 헬퍼만.
 */

/* ── 전역 설정 ── */
const CONFIG = {
  POPULAR_LIMIT:  12,
  TRUNCATE_LEN:   70,
  TOAST_MS:     3000,
  REPORT_MIN:      3,
  POSTS_CACHE_TTL: 30000,
};

/* ── 텍스트/HTML ── */

function escapeHTML(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function truncate(s, n) {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function nullIfEmpty(str) {
  const s = (str ?? '').trim();
  return s || null;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('ko-KR');
}

function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || '';
}

function extractFirstImage(html) {
  if (!html) return null;
  const m = html.match(/<img[^>]+src=['"]([^'"]+)['"]/i);
  return m ? m[1] : null;
}

/* ── 색상 ── */

function darkenHex(hex, amount = 40) {
  try {
    const n = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, (n >> 16)         - amount);
    const g = Math.max(0, ((n >> 8) & 0xff) - amount);
    const b = Math.max(0, (n & 0xff)        - amount);
    return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
  } catch { return hex; }
}

/* ── UI 헬퍼 ── */

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast' + (type ? ' ' + type : '');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), CONFIG.TOAST_MS);
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
}

function clearErrors() {
  document.querySelectorAll('.error-msg, .global-error').forEach(el => el.classList.remove('show'));
}

function setLoading(btn, loading) {
  btn.disabled = loading;
  btn.textContent = loading ? '처리 중...' : btn.dataset.label;
}

/* ── 아바타 렌더링 ── */

function renderAvatar(el, nickname, avatarUrl, color = '#4aab8e') {
  if (avatarUrl) {
    el.innerHTML = `<img src="${escapeHTML(avatarUrl)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
  } else {
    el.textContent = (nickname || '?').slice(0, 1).toUpperCase();
    el.style.background = color;
  }
}

/* ── 게시물 타입 아이콘 ── */

function postTypeIcon(p, withSpace = false) {
  const i = p.game_url ? '🎮' : p.video_url ? '🎬' : p.code_lang ? '💻' : '';
  return (withSpace && i) ? i + ' ' : i;
}

/* ── Nav 로그아웃 등록 (모든 페이지 공통) ── */

function initNavLogout(redirectUrl = 'index.html') {
  document.getElementById('navLogout')?.addEventListener('click', async e => {
    e.preventDefault();
    // authSignOut은 app.js에 정의됨 (utils.js가 먼저 로드되어도 런타임엔 존재)
    if (typeof authSignOut === 'function') await authSignOut();
    window.location.href = redirectUrl;
  });
}

/* ── 게시물 행(post-row) HTML 생성 ── */

/**
 * @param {object}  p          게시물 객체
 * @param {object}  [opts]
 * @param {boolean} [opts.showCat=true]     카테고리 뱃지 표시
 * @param {boolean} [opts.showAuthor=true]  작성자 표시
 * @param {boolean} [opts.showViews=true]   조회수 표시
 * @param {boolean} [opts.showPin=false]    핀 아이콘 표시
 */
function renderPostRowHTML(p, opts = {}) {
  const { showCat = true, showAuthor = true, showViews = true, showPin = false } = opts;
  const pin = (showPin && p.pinned) ? '<span class="post-row-pin">📌</span>' : '';
  const typeEl = document.createElement('span');
  typeEl.className = 'post-row-type-icon';
  return `
  <a class="post-row${p.pinned ? ' post-row-pinned' : ''}" href="post-detail.html?id=${p.id}">
    ${showCat ? `<span class="post-row-cat">${escapeHTML(p.category)}</span>` : ''}
    <span class="post-row-title">${pin}${postTypeIcon(p, true)}${escapeHTML(p.title)}</span>
    ${showAuthor ? `<span class="post-row-author">${escapeHTML(p.author_nickname)}</span>` : ''}
    <span class="post-row-date">${formatDate(p.created_at)}</span>
    ${showViews ? `<span class="post-row-views">👁 ${p.views || 0}</span>` : ''}
  </a>`;
}

/* ── 게시물 썸네일 HTML 생성 ── */

/**
 * @param {object}  p
 * @param {boolean} [showThumb=true]  썸네일 영역 표시 여부
 */
function renderPostThumbHtml(p, showThumb = true) {
  if (!showThumb) return '';
  const isVideo = !!p.video_url;
  const isCode  = !!p.code_lang;
  const thumb   = p.thumbnail_url || (!isCode && extractFirstImage(p.content));
  if (thumb) {
    return `<div class="news-card-thumb-wrap"><img class="news-card-thumb" src="${escapeHTML(thumb)}" alt="" loading="lazy" onerror="this.closest('.news-card-thumb-wrap').style.display='none'"></div>`;
  }
  if (isVideo) {
    return `<div class="news-card-thumb-wrap video-thumb-placeholder"><span>🎬</span></div>`;
  }
  return '';
}

/* ── 게시물 설명 HTML 생성 (카드용) ── */

function renderPostDescHtml(p) {
  const isGame  = !!p.game_url;
  const isVideo = !!p.video_url;
  const isCode  = !!p.code_lang;
  if (isCode) {
    const firstCode = (p.code_files?.length > 0) ? (p.code_files[0]?.code || '') : (p.content || '');
    const filesInfo = (p.code_files?.length > 1)
      ? `<span class="code-files-badge">${p.code_files.length}개 파일</span>` : '';
    return `<pre class="code-card-preview">${escapeHTML(truncate(firstCode, 120))}</pre>${filesInfo}`;
  }
  if (isGame || isVideo) {
    const desc = escapeHTML(p.content || '');
    return `<div class="game-card-desc-wrap">
      <p class="game-card-desc">${desc}</p>
      ${desc ? `<button class="expand-btn" type="button" data-expanded="false">펼쳐보기</button>` : ''}
    </div>`;
  }
  return `<p class="news-desc">${escapeHTML(truncate(stripHtml(p.content || ''), CONFIG.TRUNCATE_LEN))}</p>`;
}
