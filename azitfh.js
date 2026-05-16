/* ════════════════════════════════════════
   azitfh.js — 아지트 페이지 로직
   app.js의 공통 함수 (getSession, updateNav,
   showToast, escapeHTML, truncate, formatDate,
   CONFIG) 재사용
════════════════════════════════════════ */

/* ── 아지트 타입 정의 ──
   새 타입 추가 시 이 객체만 확장하면 됩니다.
   renderByType()에 해당 렌더러도 추가하세요.
── */
const AZITFH_TYPES = {
  general: { label: '커뮤니티', icon: '💬', desc: '자유롭게 글을 올리는 공간' },
  video:   { label: '영상',     icon: '🎬', desc: '영상 중심의 채널' },
  game:    { label: '게임',     icon: '🎮', desc: '게임 정보 & 공략 공간' },
  gallery: { label: '갤러리',   icon: '🖼️', desc: '이미지 중심의 전시 공간' },
};

/* ════════════════════════════════════════
   진입점
════════════════════════════════════════ */
async function initAzitfh() {
  const catName = decodeURIComponent(
    new URLSearchParams(location.search).get('cat') || ''
  );

  if (!catName) {
    document.getElementById('postsPane').innerHTML =
      '<p class="azitfh-empty">⚠️ 아지트 이름이 없어요.</p>';
    return;
  }

  const [session, azitfh] = await Promise.all([
    getSession(),
    fetchAzitfh(catName),
  ]);

  updateNav(session);
  document.getElementById('navLogout')?.addEventListener('click', async (e) => {
    e.preventDefault();
    await authSignOut();
    location.reload();
  });

  if (!azitfh) {
    document.getElementById('postsPane').innerHTML =
      '<p class="azitfh-empty">⚠️ 아지트를 찾을 수 없어요.</p>';
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
  const { data } = await supabaseClient
    .from('categories')
    .select('*')
    .eq('name', catName)
    .maybeSingle();
  return data;
}

async function fetchPosts(catName) {
  const { data, error } = await supabaseClient
    .from('posts')
    .select('*')
    .eq('category', catName)
    .eq('hidden', false)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

/* ════════════════════════════════════════
   히어로 섹션
════════════════════════════════════════ */
function renderHero(azitfh, session) {
  const type     = AZITFH_TYPES[azitfh.type] || AZITFH_TYPES.general;
  const color    = azitfh.cover_color || '#4aab8e';

  document.getElementById('heroBg').style.background =
    `linear-gradient(135deg, ${color} 0%, ${darkenHex(color, 50)} 100%)`;

  document.getElementById('heroIcon').textContent      = azitfh.icon || '🏠';
  document.getElementById('heroName').textContent      = azitfh.name;
  document.getElementById('heroDesc').textContent      = azitfh.description || type.desc;
  document.getElementById('heroTypeBadge').textContent = `${type.icon} ${type.label}`;

  if (session) {
    const btn = document.getElementById('heroWriteBtn');
    btn.href = `post-write.html?cat=${encodeURIComponent(azitfh.name)}`;
    btn.classList.remove('hidden');
  }
}

// hex 색상을 어둡게 처리 (그라디언트 끝 색상용)
function darkenHex(hex, amount = 40) {
  try {
    const n = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, (n >> 16)        - amount);
    const g = Math.max(0, ((n >> 8) & 0xff) - amount);
    const b = Math.max(0, (n & 0xff)        - amount);
    return `#${[r,g,b].map(v => v.toString(16).padStart(2,'0')).join('')}`;
  } catch { return hex; }
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

      switch (tab.dataset.tab) {
        case 'posts': await loadPosts(azitfh, catName);  break;
        case 'media': loadMediaPlaceholder(azitfh.type); break;
        case 'about': renderAbout(azitfh);                break;
      }
    });
  });
}

/* ════════════════════════════════════════
   게시물 탭 — 타입별 렌더링
════════════════════════════════════════ */
async function loadPosts(azitfh, catName) {
  const container = document.getElementById('postsPane');
  container.innerHTML = '<p class="azitfh-empty">불러오는 중…</p>';

  let posts;
  try {
    posts = await fetchPosts(catName);
  } catch {
    container.innerHTML = '<p class="azitfh-empty">게시물을 불러오지 못했어요.</p>';
    return;
  }

  // 통계 업데이트
  document.getElementById('heroPostCount').textContent   = posts.length;
  document.getElementById('heroMemberCount').textContent =
    new Set(posts.map(p => p.author_id)).size;

  if (posts.length === 0) {
    container.innerHTML =
      '<p class="azitfh-empty">아직 게시물이 없어요.<br>첫 번째 글을 올려보세요!</p>';
    return;
  }

  // 타입에 따라 다른 렌더러 선택
  renderByType(container, posts, azitfh.type || 'general');
}

/* 타입 → 렌더러 디스패치 */
function renderByType(container, posts, type) {
  switch (type) {
    case 'video':   renderAsVideoGrid(container, posts);  break;
    case 'game':    renderAsGameCards(container, posts);  break;
    case 'gallery': renderAsGallery(container, posts);    break;
    default:        renderAsPostCards(container, posts);
  }
}

/* ── general: 표준 게시물 카드 ── */
function renderAsPostCards(container, posts) {
  container.innerHTML = `
    <div class="azitfh-post-grid">
      ${posts.map(p => `
        <a class="news-card" href="post-detail.html?id=${p.id}">
          <div class="news-card-top">
            <span class="news-date">${formatDate(p.created_at)}</span>
          </div>
          <h3 class="news-title">${escapeHTML(p.title)}</h3>
          <p class="news-desc">${escapeHTML(truncate(p.content, CONFIG.TRUNCATE_LEN))}</p>
          <div class="post-meta">
            by ${escapeHTML(p.author_nickname)} · 조회 ${p.views || 0}
          </div>
        </a>
      `).join('')}
    </div>`;
}

/* ── video: 영상 그리드 ── */
function renderAsVideoGrid(container, posts) {
  container.innerHTML = `
    <div class="azitfh-video-grid">
      ${posts.map(p => `
        <a class="azitfh-video-card" href="post-detail.html?id=${p.id}">
          <div class="azitfh-video-thumb">
            <span class="azitfh-video-play">▶</span>
          </div>
          <div class="azitfh-video-info">
            <p class="azitfh-video-title">${escapeHTML(p.title)}</p>
            <p class="azitfh-video-meta">
              ${escapeHTML(p.author_nickname)} · 조회 ${p.views || 0} · ${formatDate(p.created_at)}
            </p>
          </div>
        </a>
      `).join('')}
    </div>`;
}

/* ── game: 게임 카드 리스트 ── */
function renderAsGameCards(container, posts) {
  container.innerHTML = `
    <div class="azitfh-game-list">
      ${posts.map(p => `
        <a class="azitfh-game-card" href="post-detail.html?id=${p.id}">
          <div class="azitfh-game-cover">🎮</div>
          <div class="azitfh-game-info">
            <p class="azitfh-game-title">${escapeHTML(p.title)}</p>
            <p class="azitfh-game-desc">${escapeHTML(truncate(p.content, 80))}</p>
            <p class="azitfh-game-meta">
              by ${escapeHTML(p.author_nickname)} · 조회 ${p.views || 0}
            </p>
          </div>
          <span class="azitfh-game-play">▶ 보기</span>
        </a>
      `).join('')}
    </div>`;
}

/* ── gallery: 갤러리 그리드 ── */
function renderAsGallery(container, posts) {
  container.innerHTML = `
    <div class="azitfh-gallery-grid">
      ${posts.map(p => `
        <a class="azitfh-gallery-item" href="post-detail.html?id=${p.id}">
          <div class="azitfh-gallery-img">
            <span>${escapeHTML(p.title.charAt(0).toUpperCase())}</span>
          </div>
          <p class="azitfh-gallery-title">${escapeHTML(p.title)}</p>
        </a>
      `).join('')}
    </div>`;
}

/* ════════════════════════════════════════
   미디어 탭 (플레이스홀더)
   — 향후 각 타입별 미디어 업로드 기능 구현 예정
════════════════════════════════════════ */
function loadMediaPlaceholder(type) {
  const icons   = { video: '🎬', game: '🕹️', gallery: '📸', general: '📁' };
  const labels  = { video: '영상 업로드', game: '게임 파일', gallery: '이미지 업로드', general: '파일' };
  const icon    = icons[type]  || icons.general;
  const label   = labels[type] || labels.general;

  document.getElementById('mediaPane').innerHTML = `
    <div class="azitfh-placeholder">
      <p class="azitfh-placeholder-icon">${icon}</p>
      <p class="azitfh-placeholder-title">${label} 기능 준비 중</p>
      <p class="azitfh-placeholder-desc">
        이 아지트만의 미디어 공간이 곧 열릴 예정이에요.
      </p>
    </div>`;
}

/* ════════════════════════════════════════
   정보 탭
════════════════════════════════════════ */
function renderAbout(azitfh) {
  const type = AZITFH_TYPES[azitfh.type] || AZITFH_TYPES.general;

  document.getElementById('aboutPane').innerHTML = `
    <div class="azitfh-about">
      <div class="azitfh-about-section">
        <h3>아지트 소개</h3>
        <p>${escapeHTML(azitfh.description || '소개가 없습니다.')}</p>
      </div>
      <div class="azitfh-about-section">
        <h3>아지트 정보</h3>
        <ul class="azitfh-about-list">
          <li><span>유형</span>    <span>${type.icon} ${type.label}</span></li>
          <li><span>만든이</span>  <span>${escapeHTML(azitfh.created_by || '알 수 없음')}</span></li>
          <li><span>개설일</span>  <span>${formatDate(azitfh.created_at)}</span></li>
        </ul>
      </div>
    </div>`;
}
