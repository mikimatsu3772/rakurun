import { C } from './constants.js';
import { createGame, stepGame, coverage } from './engine.js';
import { createBot, botInput } from './bot.js';
import { segmentBlocked } from './map.js';
import { makeRng } from './rng.js';
import { createRenderer } from './render.js';
import { createInput } from './input.js';

const params = new URLSearchParams(location.search);
const AUTO = params.get('auto') === '1'; // プレイヤーもBotが操作 (デモ/テスト用)
const SEED = parseInt(params.get('seed') || String((Date.now() % 100000) + 1), 10);

const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
const ctx = renderer.ctx;

let drawScale = 1;
function resize() {
  const scale = Math.min(window.innerWidth / C.W, window.innerHeight / C.H);
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = `${C.W * scale}px`;
  canvas.style.height = `${C.H * scale}px`;
  canvas.width = Math.round(C.W * scale * dpr);
  canvas.height = Math.round(C.H * scale * dpr);
  drawScale = scale * dpr;
}
window.addEventListener('resize', resize);
resize();

function toGame(e) {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * C.W, y: ((e.clientY - r.top) / r.height) * C.H };
}
const input = createInput(canvas, toGame);

// ---- 効果音 (WebAudio 簡易シンセ) ----
let audio = null;
function ensureAudio() {
  if (!audio) {
    try {
      audio = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      audio = false;
    }
  }
  if (audio && audio.state === 'suspended') audio.resume();
}
canvas.addEventListener('pointerdown', ensureAudio);
function beep(freq, dur, type = 'square', gain = 0.04, slide = 0) {
  if (!audio) return;
  const o = audio.createOscillator();
  const g = audio.createGain();
  o.type = type;
  o.frequency.value = freq;
  if (slide) o.frequency.linearRampToValueAtTime(freq + slide, audio.currentTime + dur);
  g.gain.value = gain;
  g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + dur);
  o.connect(g).connect(audio.destination);
  o.start();
  o.stop(audio.currentTime + dur);
}

// ---- 難易度 ----
const DIFFS = [
  { label: 'よわい', value: 0.35 },
  { label: 'ふつう', value: 0.6 },
  { label: 'つよい', value: 0.85 },
];
let diffIndex = params.get('diff') ? parseInt(params.get('diff'), 10) : 1;
const ALLY_DIFF = 0.7;

// ---- 状態 ----
let mode = 'title'; // title | countdown | play | result
let state = null;
let bots = [];
let countdownT = 0;
let resultT = 0;
let result = null;
let seedCounter = SEED;
const MY_ID = 0;

function startMatch() {
  seedCounter = (seedCounter * 1664525 + 1013904223) >>> 0 || 1;
  state = createGame(seedCounter);
  const botRng = makeRng(seedCounter ^ 0x51ab3d);
  const enemyDiff = DIFFS[diffIndex].value;
  bots = state.players
    .filter((p) => AUTO || p.id !== MY_ID)
    .map((p) => createBot(p.id, botRng, p.team === 0 ? ALLY_DIFF : enemyDiff));
  mode = 'countdown';
  countdownT = 2.4;
}

// 緩いオートエイム: 撃ちたい方向の±70度以内で最も近い視線の通る敵に吸着
function autoAim(me, inp) {
  let ax = inp.mx;
  let ay = inp.my;
  if (Math.hypot(ax, ay) < 0.05) {
    ax = me.faceX;
    ay = me.faceY;
  }
  let best = null;
  let bd = C.SHOT_RANGE * 1.2;
  for (const q of state.players) {
    if (q.team === me.team || q.dead || q.invulnT > 0) continue;
    const dx = q.x - me.x;
    const dy = q.y - me.y;
    const d = Math.hypot(dx, dy);
    if (d > bd) continue;
    const dot = (dx * ax + dy * ay) / (d * (Math.hypot(ax, ay) || 1));
    if (dot < 0.34) continue; // 約±70度
    if (segmentBlocked(me.x, me.y, q.x, q.y)) continue;
    bd = d;
    best = q;
  }
  if (best) {
    const d = Math.hypot(best.x - me.x, best.y - me.y) || 1;
    inp.aimX = (best.x - me.x) / d;
    inp.aimY = (best.y - me.y) / d;
  } else {
    const l = Math.hypot(ax, ay) || 1;
    inp.aimX = ax / l;
    inp.aimY = ay / l;
  }
}

function stepPlay() {
  const inputs = [];
  if (!AUTO) {
    const me = state.players[MY_ID];
    const inp = input.readPlayerInput();
    if (inp.fire && !inp.swim) autoAim(me, inp);
    inputs[MY_ID] = inp;
  }
  for (const b of bots) inputs[b.playerId] = botInput(b, state);
  stepGame(state, inputs);
  renderer.addEvents(state.events, AUTO ? -1 : MY_ID);
  for (const e of state.events) {
    if (e.type === 'shoot' && e.team === 0) beep(720 + Math.random() * 120, 0.05, 'square', 0.015);
    else if (e.type === 'kill') beep(e.team === 0 ? 200 : 420, 0.3, 'sawtooth', 0.05, -120);
    else if (e.type === 'burst') beep(180, 0.5, 'sawtooth', 0.06, 400);
  }
  if (state.over) {
    const [c0, c1] = coverage(state);
    const me = state.players[MY_ID];
    result = {
      c0,
      c1,
      win: c0 > c1 ? 0 : c1 > c0 ? 1 : -1,
      kills: me.kills,
      deaths: me.deaths,
      painted: me.painted,
    };
    mode = 'result';
    resultT = 0;
    beep(880, 0.6, 'triangle', 0.06, -300);
  }
}

// ---- タイトル画面の飾り ----
const titleBlobs = [];
{
  const r = makeRng(7);
  for (let i = 0; i < 26; i++) {
    titleBlobs.push({ x: r() * C.W, y: r() * C.H, r: 14 + r() * 42, team: r() < 0.5 ? 0 : 1, a: 0.14 + r() * 0.2 });
  }
}

function hitCircle(t, x, y, r) {
  return t && Math.hypot(t.x - x, t.y - y) <= r;
}
function hitRect(t, x, y, w, h) {
  return t && t.x >= x && t.x <= x + w && t.y >= y && t.y <= y + h;
}

function drawTitle() {
  renderer.clear();
  for (const b of titleBlobs) {
    ctx.globalAlpha = b.a;
    ctx.fillStyle = C.TEAM_COLORS[b.team].main;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 58px system-ui, sans-serif';
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#12121c';
  ctx.strokeText('INK RUSH', C.W / 2, 150);
  ctx.fillStyle = C.TEAM_COLORS[0].main;
  ctx.fillText('INK RUSH', C.W / 2, 150);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = '#cfd0e0';
  ctx.fillText('90秒の陣取りインクバトル 2 vs 2', C.W / 2, 196);

  // 難易度選択
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillStyle = '#9a9bb0';
  ctx.fillText('あいての強さ', C.W / 2, 300);
  for (let i = 0; i < DIFFS.length; i++) {
    const x = 60 + i * 90;
    const sel = i === diffIndex;
    ctx.fillStyle = sel ? C.TEAM_COLORS[1].main : 'rgba(255,255,255,0.12)';
    renderer.roundRect(x, 320, 78, 40, 12);
    ctx.fill();
    ctx.fillStyle = sel ? '#062a27' : '#e8e8f2';
    ctx.font = `bold 17px system-ui, sans-serif`;
    ctx.fillText(DIFFS[i].label, x + 39, 341);
  }

  // START
  ctx.fillStyle = C.TEAM_COLORS[0].main;
  renderer.roundRect(70, 420, 220, 64, 32);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 28px system-ui, sans-serif';
  ctx.fillText('スタート!', C.W / 2, 453);

  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = '#8a8b9e';
  ctx.fillText('左半分ドラッグ: 移動 / FIRE: 撃つ / SWIM: イカ潜行', C.W / 2, 560);
  ctx.fillText('地面を塗って、時間切れの時に広いほうが勝ち!', C.W / 2, 580);

  const t = input.consumeTap();
  if (hitRect(t, 70, 420, 220, 64)) {
    beep(660, 0.12, 'triangle', 0.06, 200);
    startMatch();
  } else {
    for (let i = 0; i < DIFFS.length; i++) {
      if (hitRect(t, 60 + i * 90, 320, 78, 40)) {
        diffIndex = i;
        beep(500 + i * 150, 0.08, 'triangle', 0.05);
      }
    }
  }
}

function drawCountdown(dt) {
  renderer.clear();
  renderer.drawMatch(state, { myId: MY_ID, auto: AUTO, joy: input.joy, buttons: input.buttons }, dt);
  countdownT -= dt;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(0, 0, C.W, C.H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const n = Math.ceil(countdownT / 0.8);
  ctx.font = 'bold 90px system-ui, sans-serif';
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#12121c';
  ctx.fillStyle = '#fff';
  const label = n > 0 ? String(n) : 'GO!';
  ctx.strokeText(label, C.W / 2, C.H / 2 - 40);
  ctx.fillText(label, C.W / 2, C.H / 2 - 40);
  if (countdownT <= 0) {
    mode = 'play';
    beep(880, 0.25, 'triangle', 0.07);
  }
  input.consumeTap();
}

function drawResult(dt) {
  renderer.clear();
  renderer.drawMatch(state, { myId: MY_ID, auto: true, joy: input.joy, buttons: input.buttons }, dt);
  resultT += dt;
  const k = Math.min(1, resultT / 0.9);
  ctx.fillStyle = 'rgba(10,10,18,0.78)';
  ctx.fillRect(0, 0, C.W, C.H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const heading = result.win === -1 ? 'ドロー' : result.win === 0 ? 'WIN!' : 'LOSE…';
  ctx.font = 'bold 54px system-ui, sans-serif';
  ctx.fillStyle = result.win === 0 ? '#ffd54a' : result.win === 1 ? '#8a8b9e' : '#cfd0e0';
  ctx.fillText(heading, C.W / 2, 120);

  // 塗り率バー (アニメーション)
  const barY = 210;
  for (let team = 0; team < 2; team++) {
    const c = team === 0 ? result.c0 : result.c1;
    const y = barY + team * 70;
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = C.TEAM_COLORS[team].main;
    ctx.fillText(team === 0 ? 'あなたのチーム' : 'あいてチーム', 30, y - 16);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    renderer.roundRect(30, y, 300, 26, 13);
    ctx.fill();
    ctx.fillStyle = C.TEAM_COLORS[team].main;
    const w = Math.max(10, 300 * c * k);
    renderer.roundRect(30, y, w, 26, 13);
    ctx.fill();
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(`${(c * k * 100).toFixed(1)}%`, 330, y + 13);
  }

  if (!AUTO) {
    ctx.textAlign = 'center';
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = '#cfd0e0';
    ctx.fillText(`たおした: ${result.kills}  やられた: ${result.deaths}  ぬった: ${result.painted}マス`, C.W / 2, 390);
  }

  // ボタン
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = C.TEAM_COLORS[0].main;
  renderer.roundRect(60, 440, 240, 56, 28);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText('もういっかい!', C.W / 2, 468);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  renderer.roundRect(100, 516, 160, 44, 22);
  ctx.fill();
  ctx.fillStyle = '#e8e8f2';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText('タイトルへ', C.W / 2, 538);

  const t = input.consumeTap();
  if (resultT > 0.6) {
    if (hitRect(t, 60, 440, 240, 56)) {
      beep(660, 0.12, 'triangle', 0.06, 200);
      startMatch();
    } else if (hitRect(t, 100, 516, 160, 44)) {
      mode = 'title';
    }
  }
}

// ---- メインループ (固定60Hzステップ + 可変描画) ----
let last = performance.now();
let acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25; // タブ復帰などの巨大デルタは捨てる

  ctx.setTransform(drawScale, 0, 0, drawScale, 0, 0);

  if (mode === 'title') {
    drawTitle();
    return;
  }
  if (mode === 'countdown') {
    drawCountdown(dt);
    return;
  }
  if (mode === 'play') {
    acc += dt;
    let guard = 0;
    while (acc >= C.TICK && guard++ < 8 && mode === 'play') {
      acc -= C.TICK;
      stepPlay();
    }
    renderer.clear();
    if (mode === 'play' || mode === 'result') {
      renderer.drawMatch(state, { myId: MY_ID, auto: AUTO, joy: input.joy, buttons: input.buttons }, dt);
    }
    if (mode === 'result') drawResult(0);
    input.consumeTap();
    return;
  }
  if (mode === 'result') {
    drawResult(dt);
  }
}
requestAnimationFrame(frame);

if (AUTO) startMatch();

// テスト・デバッグ用フック
window.__INKRUSH = {
  get mode() {
    return mode;
  },
  get state() {
    return state;
  },
  get result() {
    return result;
  },
  coverage: () => (state ? coverage(state) : null),
  start: (di) => {
    if (di !== undefined) diffIndex = di;
    startMatch();
  },
  skipCountdown: () => {
    countdownT = 0;
  },
  // テスト用: 試合をNシミュレーション秒ぶん一気に進める
  fastForward: (sec) => {
    if (mode === 'countdown') {
      mode = 'play';
      countdownT = 0;
    }
    const steps = Math.round(sec / C.TICK);
    for (let i = 0; i < steps && mode === 'play'; i++) stepPlay();
  },
};
