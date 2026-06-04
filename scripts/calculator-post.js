/**
 * 계산기 게시물 생성 스크립트
 * node scripts/calculator-post.js
 */

const SUPABASE_URL = 'https://ywyzcyvlfafmwoxjxmck.supabase.co';
const ANON_KEY     = 'sb_publishable_y7y5eFDZ3N2YDJsTL5RZ2g_b-Y91W7k';

async function login(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  const d = await res.json();
  if (!res.ok) throw new Error(d.error_description || d.message);
  return d;
}

// ── 계산기 파일들 ──────────────────────────────────────────────────────────

const indexHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>계산기</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="calc">
    <div class="display">
      <div class="expr"   id="expr"></div>
      <div class="result" id="result">0</div>
    </div>
    <div class="buttons">
      <button class="btn-ac"  data-action="ac">AC</button>
      <button class="btn-fn"  data-action="sign">+/−</button>
      <button class="btn-fn"  data-action="pct">%</button>
      <button class="btn-op"  data-op="÷">÷</button>

      <button class="btn-num" data-num="7">7</button>
      <button class="btn-num" data-num="8">8</button>
      <button class="btn-num" data-num="9">9</button>
      <button class="btn-op"  data-op="×">×</button>

      <button class="btn-num" data-num="4">4</button>
      <button class="btn-num" data-num="5">5</button>
      <button class="btn-num" data-num="6">6</button>
      <button class="btn-op"  data-op="−">−</button>

      <button class="btn-num" data-num="1">1</button>
      <button class="btn-num" data-num="2">2</button>
      <button class="btn-num" data-num="3">3</button>
      <button class="btn-op"  data-op="+">+</button>

      <button class="btn-num span2" data-num="0">0</button>
      <button class="btn-num" data-action="dot">.</button>
      <button class="btn-eq"  data-action="eq">=</button>
    </div>
    <div class="keyboard-hint">키보드 입력도 지원합니다 ⌨️</div>
  </div>
  <script src="calc.js"></script>
</body>
</html>`;

const styleCss = `* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.calc {
  background: rgba(255, 255, 255, .07);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, .12);
  border-radius: 28px;
  padding: 28px 24px 20px;
  width: 320px;
  box-shadow:
    0 40px 80px rgba(0, 0, 0, .6),
    inset 0 1px 0 rgba(255, 255, 255, .15);
}

/* ── 디스플레이 ── */
.display {
  padding: 8px 6px 16px;
  text-align: right;
  min-height: 100px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 4px;
}

.expr {
  font-size: 14px;
  color: rgba(255, 255, 255, .38);
  min-height: 20px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: .5px;
}

.result {
  font-size: 52px;
  font-weight: 200;
  color: #fff;
  letter-spacing: -1px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: font-size .15s ease;
  line-height: 1.1;
}
.result.small  { font-size: 36px; }
.result.xsmall { font-size: 26px; }
.result.error  { color: #ff6b6b; font-size: 32px; }

/* ── 버튼 그리드 ── */
.buttons {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

button {
  height: 70px;
  border: none;
  border-radius: 18px;
  font-size: 22px;
  font-weight: 400;
  cursor: pointer;
  color: #fff;
  position: relative;
  overflow: hidden;
  transition: transform .08s ease, box-shadow .08s ease;
  -webkit-tap-highlight-color: transparent;
  outline: none;
}

button::after {
  content: '';
  position: absolute; inset: 0;
  background: rgba(255, 255, 255, 0);
  transition: background .08s;
  border-radius: inherit;
}
button:hover::after  { background: rgba(255, 255, 255, .06); }
button:active::after { background: rgba(255, 255, 255, .18); }
button:active { transform: scale(.92); }

/* 버튼 타입 */
.btn-num { background: rgba(255, 255, 255, .14); }
.btn-num:hover { background: rgba(255, 255, 255, .2); }

.btn-op {
  background: #5e5ce6;
  box-shadow: 0 4px 15px rgba(94, 92, 230, .4);
}
.btn-op:hover { background: #6a68f0; }
.btn-op.active {
  background: #fff;
  color: #5e5ce6;
  box-shadow: 0 4px 20px rgba(255, 255, 255, .3);
}

.btn-eq {
  background: linear-gradient(145deg, #ff6b6b, #ee5a24);
  box-shadow: 0 4px 15px rgba(238, 90, 36, .45);
}
.btn-eq:hover { background: linear-gradient(145deg, #ff7979, #f0693a); }

.btn-fn {
  background: rgba(255, 255, 255, .1);
  color: rgba(255, 255, 255, .65);
  font-size: 16px;
  font-weight: 500;
}

.btn-ac {
  background: rgba(255, 80, 50, .22);
  color: #ffa89a;
  font-weight: 600;
  font-size: 18px;
}
.btn-ac:hover { background: rgba(255, 80, 50, .32); }

.span2 { grid-column: span 2; }

/* ── 키보드 힌트 ── */
.keyboard-hint {
  text-align: center;
  margin-top: 14px;
  font-size: 11px;
  color: rgba(255, 255, 255, .25);
  letter-spacing: .3px;
}`;

const calcJs = `'use strict';

let cur = '0', prev = '', operator = '', justEq = false;

const resEl  = document.getElementById('result');
const exprEl = document.getElementById('expr');

function render() {
  const len = cur.replace('-', '').replace('.', '').length;
  resEl.className = 'result'
    + (cur === 'Error'  ? ' error'  : '')
    + (len > 14        ? ' xsmall' : len > 10 ? ' small' : '');

  // 너무 길면 지수 표기
  if (cur !== 'Error' && cur.length > 14) {
    const n = parseFloat(cur);
    resEl.textContent = isNaN(n) ? cur : n.toExponential(4);
  } else {
    resEl.textContent = cur;
  }

  exprEl.textContent = prev && operator ? \`\${prev} \${operator}\` : '';

  // 활성 연산자 하이라이트
  document.querySelectorAll('.btn-op').forEach(b => {
    b.classList.toggle('active', !!operator && b.dataset.op === operator && !!prev && !justEq);
  });
}

// ── 입력 처리 ──────────────────────────────────────────────────────────────

function inputDigit(d) {
  if (cur === 'Error') { cur = d; render(); return; }
  if (justEq) { cur = d; justEq = false; }
  else cur = cur === '0' ? d : (cur.length < 15 ? cur + d : cur);
  render();
}

function inputDot() {
  if (cur === 'Error') { cur = '0.'; render(); return; }
  if (justEq) { cur = '0.'; justEq = false; render(); return; }
  if (!cur.includes('.')) cur += '.';
  render();
}

function inputOp(op) {
  if (cur === 'Error') return;
  if (prev && operator && !justEq) doCalc();
  prev = cur; operator = op; cur = '0'; justEq = false;
  render();
}

function doCalc() {
  const a = parseFloat(prev), b = parseFloat(cur);
  let r;
  switch (operator) {
    case '+': r = a + b; break;
    case '−': r = a - b; break;
    case '×': r = a * b; break;
    case '÷': r = b === 0 ? NaN : a / b; break;
    default: return;
  }
  if (!isFinite(r) || isNaN(r)) {
    cur = 'Error'; operator = ''; prev = ''; justEq = true; render(); return;
  }
  // 부동소수점 정리
  cur = String(parseFloat(r.toPrecision(12)));
}

function pressEq() {
  if (!operator || !prev || cur === 'Error') return;
  doCalc();
  operator = ''; prev = ''; justEq = true;
  render();
}

function pressAC() {
  cur = '0'; prev = ''; operator = ''; justEq = false; render();
}

function pressSign() {
  if (cur === '0' || cur === 'Error') return;
  cur = cur.startsWith('-') ? cur.slice(1) : '-' + cur;
  render();
}

function pressPct() {
  if (cur === 'Error') return;
  cur = String(parseFloat(cur) / 100);
  render();
}

function pressBackspace() {
  if (justEq || cur === 'Error') { pressAC(); return; }
  cur = cur.length > 1 ? cur.slice(0, -1) : '0';
  render();
}

// ── 이벤트 바인딩 ─────────────────────────────────────────────────────────

document.querySelector('.buttons').addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const { num, op, action } = btn.dataset;
  if (num    !== undefined)    inputDigit(num);
  if (op     !== undefined)    inputOp(op);
  if (action === 'eq')         pressEq();
  if (action === 'ac')         pressAC();
  if (action === 'sign')       pressSign();
  if (action === 'pct')        pressPct();
  if (action === 'dot')        inputDot();
});

const KEY_MAP = {
  '0':'0','1':'1','2':'2','3':'3','4':'4',
  '5':'5','6':'6','7':'7','8':'8','9':'9',
};
const OP_MAP  = { '+':'+', '-':'−', '*':'×', '/':'÷' };

document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (KEY_MAP[e.key] !== undefined) { inputDigit(KEY_MAP[e.key]); return; }
  if (OP_MAP[e.key]  !== undefined) { inputOp(OP_MAP[e.key]);     return; }
  switch (e.key) {
    case '.': case ',':  inputDot();        break;
    case 'Enter': case '=': pressEq();      break;
    case 'Escape': case 'Delete': pressAC(); break;
    case 'Backspace':     pressBackspace();  break;
    case '%':             pressPct();        break;
  }
});

render();`;

// ── 게시물 생성 ───────────────────────────────────────────────────────────

const EMAIL    = 'aaaa@gmail.com';
const PASSWORD = 'aaaaaaaa';

console.log('🔐 로그인 중...');
const session = await login(EMAIL, PASSWORD);
const jwt     = session.access_token;
const user    = session.user;
const nick    = user.user_metadata?.nickname || user.email;

const codeFiles = [
  { name: 'index.html', lang: 'HTML',       code: indexHtml },
  { name: 'style.css',  lang: 'CSS',        code: styleCss  },
  { name: 'calc.js',    lang: 'JavaScript', code: calcJs    },
];

const body = {
  title:           '🧮 계산기 — HTML + CSS + JS 멀티파일',
  content:         null,
  code_lang:       'HTML',
  code_files:      codeFiles,
  category:        '코딩아지트',
  author_id:       user.id,
  author_nickname: nick,
  views:           0,
};

console.log('📤 게시물 업로드 중...');
const res = await fetch(`${SUPABASE_URL}/rest/v1/posts`, {
  method:  'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey':       ANON_KEY,
    'Authorization':`Bearer ${jwt}`,
    'Prefer':       'return=representation',
  },
  body: JSON.stringify(body),
});

const data = await res.json();
if (!res.ok) throw new Error(JSON.stringify(data));

const created = Array.isArray(data) ? data[0] : data;
console.log('✅ 계산기 게시물이 등록됐어요!');
console.log(`   ID: ${created.id}`);
console.log(`   파일: index.html / style.css / calc.js (${codeFiles.length}개)`);
console.log(`   URL: https://aaa-000.vercel.app/post-detail.html?id=${created.id}`);
