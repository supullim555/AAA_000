/* ════════════════════════════════════════
   azitfh.js — 아지트 상세 페이지
   app.js 공통 함수 재사용
════════════════════════════════════════ */

/* ════════════════════════════════════════
   진입점
════════════════════════════════════════ */
async function initAzitfh() {
  const catName = decodeURIComponent(new URLSearchParams(location.search).get('cat') || '');

  if (!catName) {
    document.getElementById('postsPane').innerHTML = '<p class="azitfh-empty">⚠️ 아지트 이름이 없어요.</p>';
    return;
  }

  const [session, azitfh] = await Promise.all([getSession(), fetchAzitfh(catName)]);

  updateNav(session);
  document.getElementById('navLogout')?.addEventListener('click', async e => {
    e.preventDefault(); await authSignOut(); location.reload();
  });

  if (!azitfh) {
    document.getElementById('postsPane').innerHTML = '<p class="azitfh-empty">⚠️ 아지트를 찾을 수 없어요.</p>';
    return;
  }

  document.title = `${azitfh.name} — Open Azitfh`;
  renderHero(azitfh, session);
  initAzitSub(azitfh, session);
  initAzitfhTabs(azitfh, catName);
  await loadPosts(azitfh, catName);
}

/* ════════════════════════════════════════
   데이터
════════════════════════════════════════ */
async function fetchAzitfh(catName) {
  const { data } = await supabaseClient.from('azits').select('*').eq('name', catName).maybeSingle();
  return data;
}

const PAGE_SIZE = 20;

async function fetchAzitfhPosts(catName, sortBy = 'newest') {
  const from = (_azitPage - 1) * PAGE_SIZE;
  const to   = from + PAGE_SIZE - 1;
  let q = supabaseClient.from('posts')
    .select('*', { count: 'exact' })
    .eq('category', catName)
    .eq('hidden', false)
    .order('pinned', { ascending: false });
  if (_azitTagFilter) q = q.eq('post_tag', _azitTagFilter);
  if (sortBy === 'popular') q = q.order('vote_score', { ascending: false }).order('comment_count', { ascending: false }).order('views', { ascending: false });
  else                       q = q.order('created_at', { ascending: false });
  const { data, error, count } = await q.range(from, to);
  if (error) throw error;
  return { posts: data || [], total: count || 0 };
}

/* ════════════════════════════════════════
   구독
════════════════════════════════════════ */
async function initAzitSub(azitfh, session) {
  const btn     = document.getElementById('heroSubBtn');
  const countEl = document.getElementById('heroSubCount');
  if (!btn) return;

  btn.classList.remove('hidden');

  if (!session) {
    btn.addEventListener('click', () => { window.location.href = 'login.html'; });
    return;
  }

  let { count, isSubbed } = await getAzitSubInfo(azitfh.id);
  if (countEl) countEl.textContent = count;
  _applySubBtn(btn, isSubbed);

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      const newState = await toggleAzitSubscription(azitfh.id);
      if (newState === null) return;
      count += newState ? 1 : -1;
      if (countEl) countEl.textContent = count;
      _applySubBtn(btn, newState);
      showToast(newState ? '구독했어요!' : '구독을 취소했어요.');
    } catch { showToast('오류가 발생했어요.', 'red'); }
    finally  { btn.disabled = false; }
  });
}

function _applySubBtn(btn, isSubbed) {
  btn.className  = `btn-${isSubbed ? 'sub-active' : 'sub'}`;
  btn.textContent = isSubbed ? '✓ 구독 중' : '구독';
}

/* ════════════════════════════════════════
   히어로 섹션
════════════════════════════════════════ */
function renderHero(azitfh, session) {
  const color = azitfh.cover_color || '#4aab8e';
  const bg    = document.getElementById('heroBg');
  const dcfg  = (typeof azitfh.display_config === 'object' && azitfh.display_config)
    ? azitfh.display_config : {};

  // ── 히어로 스타일 클래스 ──
  const heroEl = document.querySelector('.azitfh-hero');
  if (heroEl) {
    const height  = dcfg.heroHeight    || 'normal';
    const align   = dcfg.heroAlign     || 'center';
    const overlay = dcfg.bannerOverlay || 'medium';
    heroEl.classList.toggle('azitfh-hero-compact',        height === 'compact');
    heroEl.classList.toggle('azitfh-hero-tall',           height === 'tall');
    heroEl.classList.toggle('azitfh-hero-align-left',     align  === 'left');
    heroEl.classList.remove('azitfh-hero-overlay-none', 'azitfh-hero-overlay-medium', 'azitfh-hero-overlay-strong');
    heroEl.classList.add(`azitfh-hero-overlay-${overlay}`);
  }

  // ── 통계 표시 여부 ──
  const statsEl = document.getElementById('heroStats');
  if (statsEl) statsEl.classList.toggle('hidden', dcfg.showHeroStats === false);

  if (azitfh.banner_url) {
    bg.style.backgroundImage   = `url('${azitfh.banner_url}')`;
    bg.style.backgroundSize    = 'cover';
    bg.style.backgroundPosition = 'center';
    bg.style.background        = '';
    bg.classList.add('has-banner');
  } else {
    bg.style.backgroundImage = '';
    bg.style.background      = `linear-gradient(135deg, ${color} 0%, ${darkenHex(color, 50)} 100%)`;
  }

  const iconEl = document.getElementById('heroIcon');
  if (azitfh.icon_url) {
    iconEl.innerHTML = `<img src="${azitfh.icon_url}" class="azitfh-icon-img" alt="">`;
  } else {
    iconEl.textContent = azitfh.icon || '🏠';
  }

  document.getElementById('heroName').textContent = azitfh.name;
  document.getElementById('heroDesc').textContent = azitfh.description || '';

  // 타입 뱃지
  const typeBadgeEl = document.getElementById('heroTypeBadge');
  if (typeBadgeEl && azitfh.type && azitfh.type !== 'general') {
    typeBadgeEl.textContent = azitfh.type;
    typeBadgeEl.classList.remove('hidden');
  }

  // 편집 버튼 (본인만)
  if (session) {
    const btn = document.getElementById('heroWriteBtn');
    btn.href = `post-write.html?cat=${encodeURIComponent(azitfh.name)}`;
    btn.classList.remove('hidden');

    // 본인 아지트면 편집 버튼 추가
    if (azitfh.creator_id === session.user.id) {
      const editBtn = document.getElementById('heroEditBtn');
      if (editBtn) {
        editBtn.href = `azit-edit.html?id=${azitfh.id}`;
        editBtn.classList.remove('hidden');
      }
    }
  }
}

/* ════════════════════════════════════════
   탭 관리
════════════════════════════════════════ */
function initAzitfhTabs(azitfh, catName) {
  document.querySelectorAll('.azitfh-tab').forEach(tab => {
    tab.addEventListener('click', async () => {
      document.querySelectorAll('.azitfh-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.azitfh-pane').forEach(p => p.classList.add('hidden'));
      tab.classList.add('active');
      document.getElementById(`pane-${tab.dataset.tab}`)?.classList.remove('hidden');
      if (tab.dataset.tab === 'posts') await loadPosts(azitfh, catName);
      if (tab.dataset.tab === 'about') renderAbout(azitfh);
    });
  });
}

/* ════════════════════════════════════════
   게시물 탭
════════════════════════════════════════ */
let _azitSort      = null; // null = display_config.defaultSort 사용
let _azitPage      = 1;
let _azitTagFilter = null; // null = 전체

async function loadPosts(azitfh, catName) {
  const container = document.getElementById('postsPane');
  container.innerHTML = '<p class="azitfh-empty">불러오는 중…</p>';

  const dcfg = (typeof azitfh.display_config === 'object' && azitfh.display_config) ? azitfh.display_config : {};
  const effectiveSort = _azitSort || dcfg.defaultSort || 'newest';
  const azitTags = Array.isArray(azitfh.post_tags) ? azitfh.post_tags : [];

  let result;
  try { result = await fetchAzitfhPosts(catName, effectiveSort); }
  catch { container.innerHTML = '<p class="azitfh-empty">게시물을 불러오지 못했어요.</p>'; return; }

  const { posts, total } = result;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  document.getElementById('heroPostCount').textContent   = total;
  document.getElementById('heroMemberCount').textContent = new Set(posts.map(p => p.author_id)).size;
  updateAzitMeta(azitfh, total);

  if (total === 0 && !_azitTagFilter) {
    container.innerHTML = '<p class="azitfh-empty">아직 게시물이 없어요.<br>첫 번째 글을 올려보세요!</p>';
    return;
  }

  const tagFilterBar = azitTags.length > 0 ? `
    <div class="azitfh-tag-filter-bar">
      <button class="azitfh-tag-btn${!_azitTagFilter ? ' active' : ''}" data-tag="">전체</button>
      ${azitTags.map(t => `<button class="azitfh-tag-btn${_azitTagFilter === t ? ' active' : ''}" data-tag="${escapeHTML(t)}">${escapeHTML(t)}</button>`).join('')}
    </div>` : '';

  const sortBar = `
    <div class="azitfh-sort-bar">
      <button class="azitfh-sort-btn${effectiveSort === 'newest'  ? ' active' : ''}" data-sort="newest">최신순</button>
      <button class="azitfh-sort-btn${effectiveSort === 'popular' ? ' active' : ''}" data-sort="popular">인기순</button>
    </div>`;

  container.innerHTML = tagFilterBar + sortBar + `<div id="azitfhGrid"></div><div id="azitPagination" class="pagination"></div>`;

  container.querySelectorAll('.azitfh-tag-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      _azitTagFilter = btn.dataset.tag || null;
      _azitPage = 1;
      await loadPosts(azitfh, catName);
    });
  });

  container.querySelectorAll('.azitfh-sort-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      _azitSort = btn.dataset.sort;
      _azitPage = 1;
      await loadPosts(azitfh, catName);
    });
  });

  if (total === 0) {
    document.getElementById('azitfhGrid').innerHTML = '<p class="azitfh-empty">해당 말머리의 게시물이 없어요.</p>';
    return;
  }

  renderPostCards(document.getElementById('azitfhGrid'), posts, azitfh.post_layout || 'card', dcfg);

  if (totalPages > 1) {
    renderPagination(document.getElementById('azitPagination'), _azitPage, totalPages, async p => {
      _azitPage = p;
      await loadPosts(azitfh, catName);
      container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
}

function renderPagination(container, currentPage, totalPages, onPageChange) {
  const pages = [];
  const delta = 2;

  pages.push(1);
  if (currentPage - delta > 2) pages.push('...');
  for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
    pages.push(i);
  }
  if (currentPage + delta < totalPages - 1) pages.push('...');
  if (totalPages > 1) pages.push(totalPages);

  container.innerHTML = `
    <button class="pg-btn pg-nav" data-page="${currentPage - 1}" ${currentPage <= 1 ? 'disabled' : ''}>‹</button>
    ${pages.map(p => p === '...'
      ? '<span class="pg-ellipsis">…</span>'
      : `<button class="pg-btn${p === currentPage ? ' active' : ''}" data-page="${p}">${p}</button>`
    ).join('')}
    <button class="pg-btn pg-nav" data-page="${currentPage + 1}" ${currentPage >= totalPages ? 'disabled' : ''}>›</button>
  `;

  container.querySelectorAll('.pg-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = parseInt(btn.dataset.page);
      if (p >= 1 && p <= totalPages) onPageChange(p);
    });
  });
}

function renderPostCards(container, posts, layout = 'card', config = {}) {
  if (layout === 'list') {
    container.className = '';  // grid 제거 — post-row가 자연스럽게 세로 쌓임
    container.innerHTML = posts.map(p => {
      const pin    = p.pinned   ? '<span class="post-row-pin">📌</span>' : '';
      const tagBdg = p.post_tag ? `<span class="post-tag-badge">${escapeHTML(p.post_tag)}</span>` : '';
      return `<a class="post-row${p.pinned ? ' post-row-pinned' : ''}" href="post-detail.html?id=${p.id}">
        <span class="post-row-title">${pin}${tagBdg}${postTypeIcon(p, true)}${escapeHTML(p.title)}</span>
        <span class="post-row-author">${escapeHTML(p.author_nickname)}</span>
        <span class="post-row-date">${formatDate(p.created_at)}</span>
        <span class="post-row-views">💬 ${p.comment_count||0} · 👁 ${p.views||0}</span>
      </a>`;
    }).join('');
    return;
  }
  if (layout === 'gallery') {
    container.className = 'azitfh-gallery-grid';
    container.innerHTML = posts.map(p => {
      const thumb = p.thumbnail_url || extractFirstImage(p.content);
      const bg = thumb ? `style="background-image:url('${escapeHTML(thumb)}')"` : '';
      return `<a class="gallery-card" href="post-detail.html?id=${p.id}" ${bg}>
        <div class="gallery-card-overlay">
          <span class="gallery-type">${postTypeIcon(p) || '📝'}</span>
          <span class="gallery-title">${escapeHTML(truncate(p.title, 40))}</span>
          <span class="gallery-meta">by ${escapeHTML(p.author_nickname)}</span>
        </div>
      </a>`;
    }).join('');
    return;
  }
  // default: card — display_config 적용
  const cols       = config.columns     || 3;
  const cardSize   = config.cardSize    || 'normal';
  const showThumb  = config.showThumbnail !== false;
  const showDesc   = config.showDesc    !== false;
  const showAuthor = config.showAuthor  !== false;
  const showDate   = config.showDate    !== false;
  const showViews  = config.showViews   !== false;

  // azitfh-post-grid 유지 + 크기 변형 클래스 추가
  container.className = `azitfh-post-grid azitfh-card-size-${cardSize}`;
  container.style.setProperty('--azit-cols', cols);

  container.innerHTML = posts.map(p => {
    const isCode    = !!p.code_lang;
    const langBadge = isCode ? `<span class="code-lang-badge-sm">${escapeHTML(p.code_lang)}</span>` : '';
    const pinBadge  = p.pinned ? '<span class="azitfh-pin-badge">📌 핀</span>' : '';
    const metaParts = [
      showAuthor ? `by ${escapeHTML(p.author_nickname)}` : '',
      `👍 ${p.vote_score||0}`,
      `💬 ${p.comment_count||0}`,
      showViews  ? `👁 ${p.views||0}` : '',
    ].filter(Boolean).join(' · ');

    return `
      <a class="news-card${p.pinned ? ' news-card-pinned' : ''}" href="post-detail.html?id=${p.id}">
        ${renderPostThumbHtml(p, showThumb)}
        <div class="news-card-top">
          ${pinBadge}<span class="news-date">${showDate ? formatDate(p.created_at) : ''}</span>${langBadge}
        </div>
        <h3 class="news-title">${p.post_tag ? `<span class="post-tag-badge">${escapeHTML(p.post_tag)}</span>` : ''}${postTypeIcon(p, true)}${escapeHTML(p.title)}</h3>
        ${showDesc ? renderPostDescHtml(p) : ''}
        ${metaParts ? `<div class="post-meta">${metaParts}</div>` : ''}
      </a>`;
  }).join('');
}

/* ════════════════════════════════════════
   정보 탭
════════════════════════════════════════ */
function renderAbout(azitfh) {
  const TYPE_GUIDE = {
    웹게임: '🎮 HTML5 웹게임 폴더를 업로드하면 게시물 안에서 바로 플레이할 수 있어요.',
    영상:   '🎬 MP4·WebM·MOV 영상 파일을 업로드하면 게시물 안에서 바로 감상할 수 있어요.',
    코드:   '💻 Python·C·C++·HTML·JS·CSS 코드를 작성하고 바로 실행해볼 수 있어요.',
    general:'📝 리치텍스트 에디터로 자유롭게 글을 쓸 수 있는 기본 공간이에요.',
  };
  const guide = TYPE_GUIDE[azitfh.type] || TYPE_GUIDE.general;

  document.getElementById('aboutPane').innerHTML = `
    <div class="azitfh-about">
      <div class="azitfh-about-section">
        <h3>아지트 소개</h3>
        <p>${escapeHTML(azitfh.description || '소개가 없습니다.')}</p>
      </div>
      <div class="azitfh-about-section">
        <h3>이 아지트에서 할 수 있는 것</h3>
        <p class="azitfh-type-guide">${guide}</p>
      </div>
      <div class="azitfh-about-section">
        <h3>아지트 정보</h3>
        <ul class="azitfh-about-list">
          <li><span>만든이</span> <span>${escapeHTML(azitfh.created_by || '알 수 없음')}</span></li>
          <li><span>개설일</span> <span>${formatDate(azitfh.created_at)}</span></li>
          <li><span>타입</span>   <span>${escapeHTML(azitfh.type || 'general')}</span></li>
        </ul>
      </div>
    </div>`;
}
