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

async function fetchAzitfhPosts(catName, sortBy = 'newest') {
  let q = supabaseClient.from('posts').select('*').eq('category', catName).eq('hidden', false);
  // 핀 게시물 항상 최상단
  q = q.order('pinned', { ascending: false });
  if (sortBy === 'popular') q = q.order('views', { ascending: false });
  else                       q = q.order('created_at', { ascending: false });
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/* ════════════════════════════════════════
   히어로 섹션
════════════════════════════════════════ */
function renderHero(azitfh, session) {
  const color = azitfh.cover_color || '#4aab8e';
  const bg    = document.getElementById('heroBg');

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
let _azitSort = 'newest';

async function loadPosts(azitfh, catName) {
  const container = document.getElementById('postsPane');
  container.innerHTML = '<p class="azitfh-empty">불러오는 중…</p>';

  let posts;
  try { posts = await fetchAzitfhPosts(catName, _azitSort); }
  catch { container.innerHTML = '<p class="azitfh-empty">게시물을 불러오지 못했어요.</p>'; return; }

  document.getElementById('heroPostCount').textContent   = posts.length;
  document.getElementById('heroMemberCount').textContent = new Set(posts.map(p => p.author_id)).size;
  updateAzitMeta(azitfh, posts.length);

  if (posts.length === 0) {
    container.innerHTML = '<p class="azitfh-empty">아직 게시물이 없어요.<br>첫 번째 글을 올려보세요!</p>';
    return;
  }

  // 정렬 헤더 + 카드
  const sortBar = `
    <div class="azitfh-sort-bar">
      <button class="azitfh-sort-btn${_azitSort === 'newest' ? ' active' : ''}" data-sort="newest">최신순</button>
      <button class="azitfh-sort-btn${_azitSort === 'popular' ? ' active' : ''}" data-sort="popular">인기순</button>
    </div>`;

  container.innerHTML = sortBar + `<div class="azitfh-post-grid" id="azitfhGrid"></div>`;

  container.querySelectorAll('.azitfh-sort-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      _azitSort = btn.dataset.sort;
      await loadPosts(azitfh, catName);
    });
  });

  const dcfg = (typeof azitfh.display_config === 'object' && azitfh.display_config) ? azitfh.display_config : {};
  renderPostCards(document.getElementById('azitfhGrid'), posts, azitfh.post_layout || 'card', dcfg);
}

function renderPostCards(container, posts, layout = 'card', config = {}) {
  if (layout === 'list') {
    container.innerHTML = posts.map(p => {
      const typeIcon = p.game_url ? '🎮 ' : p.video_url ? '🎬 ' : p.code_lang ? '💻 ' : '';
      const pin = p.pinned ? '<span class="post-row-pin">📌</span>' : '';
      return `<a class="post-row${p.pinned ? ' post-row-pinned' : ''}" href="post-detail.html?id=${p.id}">
        <span class="post-row-title">${pin}${typeIcon}${escapeHTML(p.title)}</span>
        <span class="post-row-author">${escapeHTML(p.author_nickname)}</span>
        <span class="post-row-date">${formatDate(p.created_at)}</span>
        <span class="post-row-views">👁 ${p.views||0}</span>
      </a>`;
    }).join('');
    return;
  }
  if (layout === 'gallery') {
    container.className = 'azitfh-gallery-grid';
    container.innerHTML = posts.map(p => {
      const thumb = p.thumbnail_url || extractFirstImage(p.content) ||
        (p.video_url ? null : null);
      const bg = thumb ? `style="background-image:url('${escapeHTML(thumb)}')"` : '';
      const typeIcon = p.game_url ? '🎮' : p.video_url ? '🎬' : p.code_lang ? '💻' : '📝';
      return `<a class="gallery-card" href="post-detail.html?id=${p.id}" ${bg}>
        <div class="gallery-card-overlay">
          <span class="gallery-type">${typeIcon}</span>
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

  container.className     = `azitfh-card-size-${cardSize}`;
  container.style.setProperty('--azit-cols', cols);

  const cards = posts.map(p => {
    const isGame  = !!p.game_url;
    const isVideo = !!p.video_url;
    const isCode  = !!p.code_lang;
    const thumb   = showThumb && (p.thumbnail_url || (!isCode && extractFirstImage(p.content)));
    const langBadge = isCode ? `<span class="code-lang-badge-sm">${escapeHTML(p.code_lang)}</span>` : '';

    const thumbHtml = showThumb
      ? (thumb
          ? `<div class="news-card-thumb-wrap"><img class="news-card-thumb" src="${escapeHTML(thumb)}" alt="" loading="lazy" onerror="this.closest('.news-card-thumb-wrap').style.display='none'"></div>`
          : (isVideo ? `<div class="news-card-thumb-wrap video-thumb-placeholder"><span>🎬</span></div>` : ''))
      : '';

    const typeIcon = isGame ? '🎮 ' : isVideo ? '🎬 ' : isCode ? '💻 ' : '';
    const firstCode = (p.code_files && p.code_files.length > 0) ? (p.code_files[0]?.code || '') : (p.content || '');
    const descText = isCode
      ? escapeHTML(truncate(firstCode, CONFIG.TRUNCATE_LEN))
      : (isGame || isVideo) ? escapeHTML(p.content || '')
      : escapeHTML(truncate(stripHtml(p.content || ''), CONFIG.TRUNCATE_LEN));

    const pinBadge = p.pinned ? '<span class="azitfh-pin-badge">📌 핀</span>' : '';

    const metaParts = [
      showAuthor ? `by ${escapeHTML(p.author_nickname)}` : '',
      showViews  ? `조회 ${p.views || 0}` : '',
    ].filter(Boolean).join(' · ');

    return `
      <a class="news-card${p.pinned ? ' news-card-pinned' : ''}" href="post-detail.html?id=${p.id}">
        ${thumbHtml}
        <div class="news-card-top">
          ${pinBadge}<span class="news-date">${showDate ? formatDate(p.created_at) : ''}</span>${langBadge}
        </div>
        <h3 class="news-title">${typeIcon}${escapeHTML(p.title)}</h3>
        ${showDesc ? `<p class="news-desc">${descText}</p>` : ''}
        ${metaParts ? `<div class="post-meta">${metaParts}</div>` : ''}
      </a>`;
  }).join('');

  container.innerHTML = cards;
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
