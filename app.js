/* ── Dark Mode ── */
function initDarkMode() {
  const saved = localStorage.getItem('jnaver_theme');
  if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  updateToggleIcon();

  document.getElementById('themeToggle')?.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('jnaver_theme', 'light');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('jnaver_theme', 'dark');
    }
    updateToggleIcon();
  });
}

function updateToggleIcon() {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  btn.textContent = isDark ? '☀️' : '🌙';
  btn.title = isDark ? '라이트 모드로 전환' : '다크 모드로 전환';
}

/* ── Toast ── */
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast' + (type ? ' ' + type : '');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
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

/* ── Supabase Auth ── */

async function authSignUp(email, password, nickname) {
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: { data: { nickname } }
  });
  if (error) throw error;
  return data;
}

async function authSignIn(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function authSignOut() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) throw error;
}

async function getSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  return session;
}

/* ── Nav 상태 업데이트 ── */
function updateNav(session) {
  const navLogin  = document.getElementById('navLogin');
  const navSignup = document.getElementById('navSignup');
  const navDash   = document.getElementById('navDash');
  const navLogout = document.getElementById('navLogout');

  if (session) {
    navLogin?.classList.add('hidden');
    navSignup?.classList.add('hidden');
    navDash?.classList.remove('hidden');
    navLogout?.classList.remove('hidden');
  } else {
    navLogin?.classList.remove('hidden');
    navSignup?.classList.remove('hidden');
    navDash?.classList.add('hidden');
    navLogout?.classList.add('hidden');
  }
}

/* ── Supabase 에러 메시지 한국어 변환 ── */
function toKoreanError(err) {
  const msg = err.message || '';
  if (msg.includes('already registered') || msg.includes('User already registered'))
    return '이미 사용 중인 이메일이에요.';
  if (msg.includes('Invalid login credentials'))
    return '이메일 또는 비밀번호가 틀렸어요.';
  if (msg.includes('Email not confirmed'))
    return '이메일 인증이 필요해요. 받은 메일함을 확인해 주세요 📬';
  if (msg.includes('Network') || msg.includes('fetch'))
    return '네트워크 오류가 발생했어요. 잠시 후 다시 시도해 주세요.';
  return `오류: ${msg}`;
}

/* ── 뉴스 렌더링 ── */
function renderNews() {
  const grid = document.getElementById('newsGrid');
  if (!grid || typeof NEWS_DATA === 'undefined') return;

  if (NEWS_DATA.length === 0) {
    grid.innerHTML = '<p class="news-empty">아직 게시물이 없어요.</p>';
    return;
  }

  grid.innerHTML = NEWS_DATA.map(n => `
    <a class="news-card" href="${n.href}">
      <div class="news-card-top">
        <span class="news-badge ${n.categoryType}">${n.category}</span>
        <span class="news-date">${n.date}</span>
      </div>
      <div class="news-emoji">${n.emoji}</div>
      <h3 class="news-title">${n.title}</h3>
      <p class="news-desc">${n.desc}</p>
    </a>
  `).join('');
}

/* ────────────────────────────────────────
   Page: Index
──────────────────────────────────────── */
async function initIndex() {
  const session = await getSession();
  updateNav(session);
  renderNews();

  document.getElementById('navLogout')?.addEventListener('click', async (e) => {
    e.preventDefault();
    await authSignOut();
    location.reload();
  });

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    updateNav(session);
  });
}

/* ────────────────────────────────────────
   Page: Signup
──────────────────────────────────────── */
async function initSignup() {
  const session = await getSession();
  if (session) { window.location.href = 'dashboard.html'; return; }

  const form = document.getElementById('signupForm');
  if (!form) return;

  const submitBtn = form.querySelector('[type=submit]');
  submitBtn.dataset.label = submitBtn.textContent;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const email    = form.email.value.trim();
    const pw       = form.password.value;
    const pwCheck  = form.passwordCheck.value;
    const nickname = form.nickname.value.trim();

    let ok = true;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError('err-email', '올바른 이메일 형식으로 입력해 주세요.');
      ok = false;
    }
    if (pw.length < 8) {
      showError('err-pw', '비밀번호는 8자 이상이어야 해요.');
      ok = false;
    }
    if (pw !== pwCheck) {
      showError('err-pwcheck', '비밀번호가 일치하지 않아요.');
      ok = false;
    }
    if (nickname.length < 2 || nickname.length > 10) {
      showError('err-nickname', '닉네임은 2~10자로 입력해 주세요.');
      ok = false;
    }
    if (!ok) return;

    setLoading(submitBtn, true);
    try {
      await authSignUp(email, pw, nickname);
      showToast('가입 완료! 이메일을 확인해 주세요 📬', 'green');
      // 이메일 인증을 끄려면 Supabase 대시보드 → Authentication → Providers → Email → Confirm email 해제
      setTimeout(() => { window.location.href = 'login.html'; }, 2200);
    } catch (err) {
      showError('err-global', toKoreanError(err));
    } finally {
      setLoading(submitBtn, false);
    }
  });
}

/* ────────────────────────────────────────
   Page: Login
──────────────────────────────────────── */
async function initLogin() {
  const session = await getSession();
  if (session) { window.location.href = 'dashboard.html'; return; }

  const form = document.getElementById('loginForm');
  if (!form) return;

  const submitBtn = form.querySelector('[type=submit]');
  submitBtn.dataset.label = submitBtn.textContent;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const email = form.email.value.trim();
    const pw    = form.password.value;

    if (!email || !pw) {
      showError('err-login', '이메일과 비밀번호를 모두 입력해 주세요.');
      return;
    }

    setLoading(submitBtn, true);
    try {
      const { user } = await authSignIn(email, pw);
      const nickname = user.user_metadata?.nickname || user.email;
      showToast(`반가워요, ${nickname}님! 🌟`, 'green');
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 1200);
    } catch (err) {
      showError('err-login', toKoreanError(err));
    } finally {
      setLoading(submitBtn, false);
    }
  });
}

/* ────────────────────────────────────────
   Page: Dashboard (세션 유지/로그아웃)
──────────────────────────────────────── */
async function initDashboard() {
  // 세션 확인 — 없으면 로그인 페이지로
  const session = await getSession();
  if (!session) { window.location.href = 'login.html'; return; }

  const user     = session.user;
  const nickname = user.user_metadata?.nickname || user.email;
  const joinDate = new Date(user.created_at).toLocaleDateString('ko-KR');

  const nameEl  = document.getElementById('userName');
  const dateEl  = document.getElementById('joinDate');
  const emailEl = document.getElementById('userEmail');

  if (nameEl)  nameEl.textContent  = nickname;
  if (dateEl)  dateEl.textContent  = joinDate;
  if (emailEl) emailEl.textContent = user.email;

  // 로그아웃 버튼 (본문)
  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await authSignOut();
    window.location.href = 'index.html';
  });

  // 로그아웃 버튼 (헤더)
  document.getElementById('navLogout')?.addEventListener('click', async (e) => {
    e.preventDefault();
    await authSignOut();
    window.location.href = 'index.html';
  });

  // 토큰 갱신 등 세션 변화 감지
  supabaseClient.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') window.location.href = 'index.html';
  });
}
