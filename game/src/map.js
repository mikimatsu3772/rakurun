import { C } from './constants.js';

// 障害物は180度回転対称に配置 (公平性のため)。rect: [x, y, w, h]
export const OBSTACLES = [
  [130, 285, 100, 70], // 中央ブロック (自己対称)
  [30, 150, 64, 34],
  [266, 456, 64, 34], // ↑の対称
  [246, 210, 84, 30],
  [30, 400, 84, 30], // ↑の対称
  [166, 96, 28, 28],
  [166, 516, 28, 28], // ↑の対称
];

// スポーン位置: チーム0が下、チーム1が上
export const SPAWNS = [
  [
    { x: 140, y: 606 },
    { x: 220, y: 606 },
  ],
  [
    { x: 220, y: 34 },
    { x: 140, y: 34 },
  ],
];

export const GRID_W = Math.floor(C.W / C.CELL);
export const GRID_H = Math.floor(C.H / C.CELL);

// grid値: 0=未塗装, 1=チーム0, 2=チーム1, 3=障害物(塗装不可)
export function makeGrid() {
  const g = new Uint8Array(GRID_W * GRID_H);
  for (const [ox, oy, ow, oh] of OBSTACLES) {
    const x0 = Math.floor(ox / C.CELL);
    const y0 = Math.floor(oy / C.CELL);
    const x1 = Math.ceil((ox + ow) / C.CELL);
    const y1 = Math.ceil((oy + oh) / C.CELL);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        if (x >= 0 && x < GRID_W && y >= 0 && y < GRID_H) g[y * GRID_W + x] = 3;
      }
    }
  }
  return g;
}

export function pointInObstacle(x, y, pad = 0) {
  for (const [ox, oy, ow, oh] of OBSTACLES) {
    if (x > ox - pad && x < ox + ow + pad && y > oy - pad && y < oy + oh + pad) return true;
  }
  return false;
}

// 円と障害物・外壁の衝突解決。位置を押し戻した {x, y} を返す。
export function resolveCircle(x, y, r) {
  x = Math.max(r, Math.min(C.W - r, x));
  y = Math.max(r, Math.min(C.H - r, y));
  for (const [ox, oy, ow, oh] of OBSTACLES) {
    const cx = Math.max(ox, Math.min(ox + ow, x));
    const cy = Math.max(oy, Math.min(oy + oh, y));
    const dx = x - cx;
    const dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * r;
        y = cy + (dy / d) * r;
      } else {
        // 中心が矩形内: 最も近い辺へ押し出す
        const left = x - ox, right = ox + ow - x, top = y - oy, bottom = oy + oh - y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) x = ox - r;
        else if (m === right) x = ox + ow + r;
        else if (m === top) y = oy - r;
        else y = oy + oh + r;
      }
    }
  }
  return { x, y };
}

// 線分が障害物と交差するか (視線判定・弾用、粗いサンプリング)
export function segmentBlocked(x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(len / 6));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (pointInObstacle(x0 + dx * t, y0 + dy * t)) return true;
  }
  return false;
}
