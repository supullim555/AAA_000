/* ════════════════════════════════════════
   azitfh.js — 아지트 커뮤니티 엔진
   app.js의 공통 함수 (getSession, updateNav,
   showToast, escapeHTML, truncate, formatDate,
   CONFIG) 재사용
════════════════════════════════════════ */

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
    .from('azits')
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
  const color = azitfh.cover_color || '#4aab8e';

  document.getElementById('heroBg').style.background =
    `linear-gradient(135deg, ${color} 0%, ${darkenHex(color, 50)} 100%)`;

  document.getElementById('heroIcon').textContent = azitfh.icon || '🏠';
  document.getElementById('heroName').textContent = azitfh.name;
  document.getElementById('heroDesc').textContent = azitfh.description || '';

  if (session) {
    const btn = document.getElementById('heroWriteBtn');
    btn.href = `post-write.html?cat=${encodeURIComponent(azitfh.name)}`;
    btn.classList.remove('hidden');
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

      switch (tab.dataset.tab) {
        case 'posts': await loadPosts(azitfh, catName); break;
        case 'about': renderAbout(azitfh);               break;
      }
    });
  });
}

/* ════════════════════════════════════════
   게시물 탭
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

  document.getElementById('heroPostCount').textContent   = posts.length;
  document.getElementById('heroMemberCount').textContent =
    new Set(posts.map(p => p.author_id)).size;

  if (posts.length === 0) {
    container.innerHTML =
      '<p class="azitfh-empty">아직 게시물이 없어요.<br>첫 번째 글을 올려보세요!</p>';
    return;
  }

  renderPostCards(container, posts);
}

function renderPostCards(container, posts) {
  const cards = posts.map(p => {
    const isGame  = !!p.game_url;
    const isVideo = !!p.video_url;
    const isCode  = !!p.code_lang;
    const thumb   = p.thumbnail_url || (!isCode && extractFirstImage(p.content));

    const thumbHtml = thumb
      ? `<div class="news-card-thumb-wrap"><img class="news-card-thumb" src="${escapeHTML(thumb)}" alt="" loading="lazy" onerror="this.closest('.news-card-thumb-wrap').style.display='none'"></div>`
      : (isVideo ? `<div class="news-card-thumb-wrap video-thumb-placeholder"><span>🎬</span></div>` : '');

    const typeIcon = isGame ? '🎮 ' : isVideo ? '🎬 ' : isCode ? '💻 ' : '';
    const desc     = isCode
      ? escapeHTML(truncate(p.content || '', CONFIG.TRUNCATE_LEN))
      : (isGame || isVideo) ? escapeHTML(p.content || '')
      : escapeHTML(truncate(stripHtml(p.content || ''), CONFIG.TRUNCATE_LEN));

    return `
      <a class="news-card" href="post-detail.html?id=${p.id}">
        ${thumbHtml}
        <div class="news-card-top">
          <span class="news-date">${formatDate(p.created_at)}</span>
        </div>
        <h3 class="news-title">${typeIcon}${escapeHTML(p.title)}</h3>
        <p class="news-desc">${desc}</p>
        <div class="post-meta">by ${escapeHTML(p.author_nickname)} · 조회 ${p.views || 0}</div>
      </a>`;
  }).join('');

  container.innerHTML = `<div class="azitfh-post-grid">${cards}</div>`;
}

/* ════════════════════════════════════════
   정보 탭
════════════════════════════════════════ */
function renderAbout(azitfh) {
  document.getElementById('aboutPane').innerHTML = `
    <div class="azitfh-about">
      <div class="azitfh-about-section">
        <h3>아지트 소개</h3>
        <p>${escapeHTML(azitfh.description || '소개가 없습니다.')}</p>
      </div>
      <div class="azitfh-about-section">
        <h3>아지트 정보</h3>
        <ul class="azitfh-about-list">
          <li><span>만든이</span> <span>${escapeHTML(azitfh.created_by || '알 수 없음')}</span></li>
          <li><span>개설일</span> <span>${formatDate(azitfh.created_at)}</span></li>
        </ul>
      </div>
    </div>`;
}
