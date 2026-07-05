import { C } from './constants.js';
import { groundAt, coverage } from './engine.js';
import { segmentBlocked, pointInObstacle, GRID_W, GRID_H } from './map.js';

// Bot AI。0.25秒間隔(個体ジッタ付き)で意思決定し、フレームごとの入力を生成する。
// difficulty: 0.0(弱)〜1.0(強)。エイムノイズと反応間隔に影響。

export function createBot(playerId, rng, difficulty = 0.75) {
  return {
    playerId,
    rng,
    difficulty,
    thinkT: rng() * 0.25,
    mode: 'paint',
    targetX: C.W / 2,
    targetY: C.H / 2,
    engageId: -1,
    strafeDir: rng() < 0.5 ? 1 : -1,
    fireHold: false,
    burstT: 0,
  };
}

function pickPaintTarget(bot, state, p) {
  // 未塗装・敵色セルを重み付きサンプリングして目的地を選ぶ
  const enemyV = 2 - p.team;
  let bestScore = -Infinity;
  let bx = C.W / 2;
  let by = C.H / 2;
  // 弱いBotほど候補地の吟味が雑になる (塗り効率に難易度を効かせる)
  const samples = 6 + Math.round(bot.difficulty * 8);
  for (let k = 0; k < samples; k++) {
    const cx = Math.floor(bot.rng() * GRID_W);
    const cy = Math.floor(bot.rng() * GRID_H);
    const v = state.grid[cy * GRID_W + cx];
    if (v === 3 || v === p.team + 1) continue;
    const x = cx * C.CELL + C.CELL / 2;
    const y = cy * C.CELL + C.CELL / 2;
    // 周辺の塗り価値 (未塗装/敵色の密度)
    let value = 0;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) continue;
        const nv = state.grid[ny * GRID_W + nx];
        if (nv === 0) value += 1;
        else if (nv === enemyV) value += 1.4;
      }
    }
    const dist = Math.hypot(x - p.x, y - p.y);
    const score = value - dist * 0.045;
    if (score > bestScore) {
      bestScore = score;
      bx = x;
      by = y;
    }
  }
  bot.targetX = bx;
  bot.targetY = by;
}

function think(bot, state, p) {
  const enemies = state.players.filter((q) => q.team !== p.team && !q.dead && q.invulnT <= 0);

  // インク切れ → 回復モード
  if (p.ink < 14) {
    bot.mode = 'recover';
    bot.engageId = -1;
    return;
  }
  if (bot.mode === 'recover' && p.ink < 70) return; // 回復継続

  // 近くの敵と交戦するか
  let nearest = null;
  let nd = Infinity;
  for (const q of enemies) {
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < nd && !segmentBlocked(p.x, p.y, q.x, q.y)) {
      nd = d;
      nearest = q;
    }
  }
  const endgame = C.MATCH_TIME - state.time < 20; // 終盤は塗り優先
  const engageRange = endgame ? 75 : 100;
  // 塗りゲーなので毎回は喧嘩を買わない
  if (nearest && nd < engageRange && p.hp > 55 && bot.rng() > 0.6) {
    bot.mode = 'engage';
    bot.engageId = nearest.id;
    if (bot.rng() < 0.3) bot.strafeDir = -bot.strafeDir;
    return;
  }

  bot.mode = 'paint';
  bot.engageId = -1;
  const distToTarget = Math.hypot(bot.targetX - p.x, bot.targetY - p.y);
  const targetGround = groundAt(state, bot.targetX, bot.targetY);
  if (distToTarget < 30 || targetGround === p.team + 1 || bot.rng() < 0.15) {
    pickPaintTarget(bot, state, p);
  }
}

// 毎フレーム呼び、engine用の入力 {mx,my,fire,swim,special,aimX,aimY} を返す
export function botInput(bot, state) {
  const p = state.players[bot.playerId];
  if (p.dead) {
    bot.mode = 'paint';
    return {};
  }

  bot.thinkT -= C.TICK;
  if (bot.thinkT <= 0) {
    bot.thinkT = 0.2 + (1 - bot.difficulty) * 0.5 + bot.rng() * 0.08;
    think(bot, state, p);
  }

  const inp = { mx: 0, my: 0, fire: false, swim: false, special: false, aimX: 0, aimY: 0 };

  // スペシャル: 満タンで敵が近い or 塗りたい地点が近い
  if (p.special >= C.SPECIAL_POINTS) {
    const enemyNear = state.players.some(
      (q) => q.team !== p.team && !q.dead && Math.hypot(q.x - p.x, q.y - p.y) < 110
    );
    if (enemyNear || groundAt(state, p.x, p.y) !== p.team + 1 || bot.rng() < 0.02) inp.special = true;
  }

  if (bot.mode === 'recover') {
    // 自インク上で潜行してタンク回復。自インクにいなければ足元を塗ってから潜る
    if (groundAt(state, p.x, p.y) === p.team + 1) {
      inp.swim = true;
      inp.mx = Math.sin(state.time * 3 + p.id) * 0.3;
      inp.my = Math.cos(state.time * 3 + p.id) * 0.3;
    } else if (p.ink >= C.INK_MIN_TO_FIRE) {
      inp.fire = true;
      inp.aimX = p.faceX;
      inp.aimY = p.faceY;
    } else {
      inp.swim = true; // 塗れないなら這って自陣方向へ
      inp.my = p.team === 0 ? 1 : -1;
    }
    return inp;
  }

  if (bot.mode === 'engage') {
    const q = state.players[bot.engageId];
    if (!q || q.dead) {
      bot.mode = 'paint';
    } else {
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      // 偏差撃ち + 難易度依存ノイズ
      const lead = d / C.SHOT_SPEED * 0.6;
      const noise = 0.15 + (1 - bot.difficulty) * 1.1;
      let ax = dx + (q.vxEst || 0) * lead + (bot.rng() - 0.5) * noise * d;
      let ay = dy + (q.vyEst || 0) * lead + (bot.rng() - 0.5) * noise * d;
      const al = Math.hypot(ax, ay) || 1;
      inp.aimX = ax / al;
      inp.aimY = ay / al;
      inp.fire = p.ink >= C.INK_MIN_TO_FIRE;
      // 距離を保ちつつストレイフ
      const ideal = C.SHOT_RANGE * 0.7;
      const approach = d > ideal ? 0.7 : -0.5;
      inp.mx = (dx / d) * approach + (-dy / d) * bot.strafeDir * 0.7;
      inp.my = (dy / d) * approach + (dx / d) * bot.strafeDir * 0.7;
      return inp;
    }
  }

  // paint モード: 目的地へ移動しながら進行方向を塗る
  const dx = bot.targetX - p.x;
  const dy = bot.targetY - p.y;
  const d = Math.hypot(dx, dy) || 1;
  let mx = dx / d;
  let my = dy / d;
  // 障害物の簡易回避: 少し先が壁ならスライド
  if (pointInObstacle(p.x + mx * 26, p.y + my * 26, C.PLAYER_RADIUS)) {
    const t = mx;
    mx = -my * bot.strafeDir;
    my = t * bot.strafeDir;
  }
  inp.mx = mx;
  inp.my = my;

  const onOwnInk = groundAt(state, p.x, p.y) === p.team + 1;
  const ground = groundAt(state, p.x + mx * 30, p.y + my * 30);
  if (onOwnInk && ground === p.team + 1 && p.ink > 55 && d > 70) {
    // 進路が既に自色なら潜行で高速移動
    inp.swim = true;
  } else {
    // 進行方向を塗りながら進む (インク節約のためバースト射撃)。
    // 射撃の手数も難易度でスケールさせる。
    bot.burstT += C.TICK;
    const duty = 0.45 + bot.difficulty * 0.25;
    const cycle = bot.burstT % 0.9;
    inp.fire = cycle < 0.9 * duty && p.ink >= C.INK_MIN_TO_FIRE;
    inp.aimX = mx;
    inp.aimY = my;
  }
  return inp;
}
