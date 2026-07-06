import { C } from './constants.js';

// タッチ/マウス/キーボード入力。左半面は動的出現の仮想スティック、
// 右下は FIRE / SWIM / SPECIAL ボタン。

export const BUTTONS = {
  fire: { x: 298, y: 548, r: 44, held: false },
  swim: { x: 218, y: 596, r: 30, held: false },
  special: { x: 316, y: 448, r: 26, held: false },
};

export function createInput(canvas, toGame) {
  const joy = { active: false, id: -1, ox: 0, oy: 0, dx: 0, dy: 0 };
  const touches = new Map(); // pointerId -> 'joy' | 'fire' | 'swim' | 'special'
  const keys = new Set();
  let specialTapped = false;
  let anyTap = null; // 直近のタップ座標 (画面遷移用)

  function buttonAt(x, y) {
    for (const [name, b] of Object.entries(BUTTONS)) {
      if (Math.hypot(x - b.x, y - b.y) <= b.r + 8) return name;
    }
    return null;
  }

  function down(e) {
    const { x, y } = toGame(e);
    anyTap = { x, y };
    const b = buttonAt(x, y);
    if (b) {
      touches.set(e.pointerId, b);
      BUTTONS[b].held = true;
      if (b === 'special') specialTapped = true;
    } else if (x < 210 && !joy.active) {
      joy.active = true;
      joy.id = e.pointerId;
      joy.ox = x;
      joy.oy = y;
      joy.dx = 0;
      joy.dy = 0;
      touches.set(e.pointerId, 'joy');
    }
  }

  function move(e) {
    if (touches.get(e.pointerId) !== 'joy') return;
    const { x, y } = toGame(e);
    let dx = (x - joy.ox) / 44;
    let dy = (y - joy.oy) / 44;
    const l = Math.hypot(dx, dy);
    if (l > 1) {
      dx /= l;
      dy /= l;
    }
    joy.dx = dx;
    joy.dy = dy;
  }

  function up(e) {
    const t = touches.get(e.pointerId);
    if (t === 'joy') {
      joy.active = false;
      joy.dx = 0;
      joy.dy = 0;
    } else if (t) {
      BUTTONS[t].held = false;
    }
    touches.delete(e.pointerId);
  }

  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  // デスクトップ検証用キーボード (WASD/矢印 + J=FIRE K=SWIM L=SP)
  window.addEventListener('keydown', (e) => {
    keys.add(e.key.toLowerCase());
    if (e.key.toLowerCase() === 'l') specialTapped = true;
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

  // engine 用のプレイヤー入力を組み立てる。autoAim は main.js 側で解決。
  function readPlayerInput() {
    let mx = joy.dx;
    let my = joy.dy;
    if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
    if (keys.has('d') || keys.has('arrowright')) mx += 1;
    if (keys.has('w') || keys.has('arrowup')) my -= 1;
    if (keys.has('s') || keys.has('arrowdown')) my += 1;
    const inp = {
      mx,
      my,
      fire: BUTTONS.fire.held || keys.has('j'),
      swim: BUTTONS.swim.held || keys.has('k'),
      special: specialTapped,
    };
    specialTapped = false;
    return inp;
  }

  function consumeTap() {
    const t = anyTap;
    anyTap = null;
    return t;
  }

  return { joy, buttons: BUTTONS, readPlayerInput, consumeTap };
}
