import { C } from './constants.js';
import { makeRng } from './rng.js';
import { makeGrid, resolveCircle, pointInObstacle, SPAWNS, GRID_W, GRID_H } from './map.js';

// 純粋ゲームロジック。描画・入力と完全分離し、Node でもブラウザでも動く。
// 固定60Hzステップ + シード乱数で決定的に進行する。

export function createGame(seed = 1) {
  const grid = makeGrid();
  let paintable = 0;
  for (let i = 0; i < grid.length; i++) if (grid[i] !== 3) paintable++;
  const players = [];
  for (let team = 0; team < 2; team++) {
    for (let slot = 0; slot < 2; slot++) {
      const sp = SPAWNS[team][slot];
      players.push({
        id: players.length,
        team,
        slot,
        x: sp.x,
        y: sp.y,
        faceX: 0,
        faceY: team === 0 ? -1 : 1,
        hp: C.HP_MAX,
        ink: C.INK_MAX,
        dead: false,
        respawnT: 0,
        invulnT: C.INVULN_TIME,
        fireCd: 0,
        swimming: false,
        firing: false,
        special: 0,
        kills: 0,
        deaths: 0,
        painted: 0, // 生涯塗りセル数 (統計用)
      });
    }
  }
  return {
    seed,
    rng: makeRng(seed),
    time: 0,
    over: false,
    grid,
    paintable,
    counts: [0, 0], // チームごとの塗りセル数
    players,
    shots: [],
    events: [], // 1ステップ分の演出イベント
  };
}

// 半径radiusの円形にチームteamで塗る。新規に自チーム色になったセル数を返す。
export function paint(state, px, py, radius, team) {
  const { grid } = state;
  const v = team + 1;
  const c0x = Math.max(0, Math.floor((px - radius) / C.CELL));
  const c1x = Math.min(GRID_W - 1, Math.floor((px + radius) / C.CELL));
  const c0y = Math.max(0, Math.floor((py - radius) / C.CELL));
  const c1y = Math.min(GRID_H - 1, Math.floor((py + radius) / C.CELL));
  const r2 = radius * radius;
  let gained = 0;
  for (let cy = c0y; cy <= c1y; cy++) {
    for (let cx = c0x; cx <= c1x; cx++) {
      const dx = cx * C.CELL + C.CELL / 2 - px;
      const dy = cy * C.CELL + C.CELL / 2 - py;
      if (dx * dx + dy * dy > r2) continue;
      const i = cy * GRID_W + cx;
      const cur = grid[i];
      if (cur === 3 || cur === v) continue;
      if (cur !== 0) state.counts[cur - 1]--;
      grid[i] = v;
      state.counts[team]++;
      gained++;
      if (state.onPaint) state.onPaint(cx, cy, v);
    }
  }
  return gained;
}

export function groundAt(state, x, y) {
  const cx = Math.max(0, Math.min(GRID_W - 1, Math.floor(x / C.CELL)));
  const cy = Math.max(0, Math.min(GRID_H - 1, Math.floor(y / C.CELL)));
  return state.grid[cy * GRID_W + cx];
}

export function coverage(state) {
  return [state.counts[0] / state.paintable, state.counts[1] / state.paintable];
}

function killPlayer(state, p, killer) {
  p.dead = true;
  p.hp = 0;
  p.respawnT = C.RESPAWN_TIME;
  p.deaths++;
  p.swimming = false;
  if (killer) killer.kills++;
  state.events.push({ type: 'kill', x: p.x, y: p.y, team: p.team, victim: p.id });
}

function damagePlayer(state, p, dmg, attacker) {
  if (p.dead || p.invulnT > 0) return;
  p.hp -= dmg;
  if (p.hp <= 0) killPlayer(state, p, attacker);
}

// inputs: プレイヤーidごとの {mx, my, fire, swim, special, aimX, aimY}
// mx,my は移動ベクトル(長さ<=1)。aimX/aimY は正規化済み射撃方向(省略時は向き)。
export function stepGame(state, inputs) {
  const dt = C.TICK;
  state.events = [];
  if (state.over) return;
  state.time += dt;
  if (state.time >= C.MATCH_TIME) {
    state.over = true;
    return;
  }

  for (const p of state.players) {
    const inp = inputs[p.id] || {};

    // リスポーン処理
    if (p.dead) {
      p.respawnT -= dt;
      if (p.respawnT <= 0) {
        const sp = SPAWNS[p.team][p.slot];
        p.x = sp.x;
        p.y = sp.y;
        p.hp = C.HP_MAX;
        p.ink = C.INK_MAX;
        p.dead = false;
        p.invulnT = C.INVULN_TIME;
        p.faceY = p.team === 0 ? -1 : 1;
        p.faceX = 0;
      }
      continue;
    }
    if (p.invulnT > 0) p.invulnT -= dt;
    if (p.fireCd > 0) p.fireCd -= dt;

    const ground = groundAt(state, p.x, p.y);
    const onOwnInk = ground === p.team + 1;
    const onEnemyInk = ground === 2 - p.team;

    p.swimming = !!inp.swim;
    p.firing = !!inp.fire && !p.swimming;

    // 移動
    let mx = inp.mx || 0;
    let my = inp.my || 0;
    const ml = Math.hypot(mx, my);
    if (ml > 1) {
      mx /= ml;
      my /= ml;
    }
    if (ml > 0.05) {
      p.faceX = mx / (ml > 1 ? 1 : ml);
      p.faceY = my / (ml > 1 ? 1 : ml);
    }
    let speed;
    if (onEnemyInk) speed = p.swimming ? C.ENEMY_INK_SPEED * 0.8 : C.ENEMY_INK_SPEED;
    else if (p.swimming) speed = onOwnInk ? C.SWIM_SPEED : C.UNPAINTED_SWIM_SPEED;
    else if (p.firing) speed = C.FIRE_MOVE_SPEED;
    else speed = C.RUN_SPEED;
    const pos = resolveCircle(p.x + mx * speed * dt, p.y + my * speed * dt, C.PLAYER_RADIUS);
    p.x = pos.x;
    p.y = pos.y;

    // 敵インクのスリップダメージ (HP下限あり)
    if (onEnemyInk && !p.dead && p.invulnT <= 0 && p.hp > C.ENEMY_INK_HP_FLOOR) {
      p.hp = Math.max(C.ENEMY_INK_HP_FLOOR, p.hp - C.ENEMY_INK_DPS * dt);
    }

    // スペシャル発動
    if (inp.special && p.special >= C.SPECIAL_POINTS) {
      p.special = 0;
      const gained = paint(state, p.x, p.y, C.SPECIAL_PAINT_RADIUS, p.team);
      p.painted += gained;
      for (const q of state.players) {
        if (q.team !== p.team && !q.dead) {
          if (Math.hypot(q.x - p.x, q.y - p.y) <= C.SPECIAL_DAMAGE_RADIUS) {
            damagePlayer(state, q, C.SPECIAL_DAMAGE, p);
          }
        }
      }
      state.events.push({ type: 'burst', x: p.x, y: p.y, team: p.team });
    }

    // 射撃
    let fired = false;
    if (p.firing && p.fireCd <= 0 && p.ink >= C.INK_MIN_TO_FIRE) {
      let ax = inp.aimX;
      let ay = inp.aimY;
      if (ax === undefined || (ax === 0 && ay === 0)) {
        ax = p.faceX;
        ay = p.faceY;
      }
      const al = Math.hypot(ax, ay) || 1;
      const noise = (state.rng() - 0.5) * 2 * C.SHOT_SPREAD;
      const cos = Math.cos(noise);
      const sin = Math.sin(noise);
      const dx = (ax / al) * cos - (ay / al) * sin;
      const dy = (ax / al) * sin + (ay / al) * cos;
      state.shots.push({
        team: p.team,
        owner: p.id,
        x: p.x + dx * (C.PLAYER_RADIUS + 2),
        y: p.y + dy * (C.PLAYER_RADIUS + 2),
        vx: dx * C.SHOT_SPEED,
        vy: dy * C.SHOT_SPEED,
        dist: 0,
        drop: 0,
      });
      p.ink -= C.INK_COST_PER_SHOT;
      p.fireCd = C.FIRE_INTERVAL;
      fired = true;
      state.events.push({ type: 'shoot', x: p.x, y: p.y, team: p.team });
    }

    // インク回復 (発射したフレームは回復しない)
    if (!fired) {
      const regen = p.swimming && onOwnInk ? C.INK_REGEN_SWIM : C.INK_REGEN_STAND;
      p.ink = Math.min(C.INK_MAX, p.ink + regen * dt);
    }
  }

  // 弾の更新。ダメージは全弾の判定後にまとめて適用し、相打ちが順序依存にならないようにする。
  const alive = [];
  const pendingHits = [];
  for (const s of state.shots) {
    const step = Math.hypot(s.vx, s.vy) * dt;
    const nx = s.x + s.vx * dt;
    const ny = s.y + s.vy * dt;
    let ended = false;

    // 障害物・外壁
    if (nx < 0 || nx > C.W || ny < 0 || ny > C.H || pointInObstacle(nx, ny)) {
      splash(state, s, s.x, s.y);
      ended = true;
    }

    // プレイヤー命中
    if (!ended) {
      for (const q of state.players) {
        if (q.team === s.team || q.dead) continue;
        const hitR = (q.swimming ? C.SWIM_RADIUS : C.PLAYER_RADIUS) + C.SHOT_RADIUS;
        if (Math.hypot(q.x - nx, q.y - ny) <= hitR) {
          pendingHits.push({ target: q, attacker: state.players[s.owner] });
          splash(state, s, nx, ny);
          ended = true;
          break;
        }
      }
    }

    if (!ended) {
      s.x = nx;
      s.y = ny;
      s.dist += step;
      s.drop += step;
      if (s.drop >= C.DROPLET_SPACING) {
        s.drop -= C.DROPLET_SPACING;
        const g = paint(state, s.x, s.y, C.DROPLET_PAINT_RADIUS, s.team);
        state.players[s.owner].special += g;
        state.players[s.owner].painted += g;
      }
      if (s.dist >= C.SHOT_RANGE) {
        splash(state, s, s.x, s.y);
        ended = true;
      }
    }
    if (!ended) alive.push(s);
  }
  state.shots = alive;
  for (const h of pendingHits) damagePlayer(state, h.target, C.SHOT_DAMAGE, h.attacker);
}

function splash(state, shot, x, y) {
  const g = paint(state, x, y, C.SPLASH_PAINT_RADIUS, shot.team);
  const owner = state.players[shot.owner];
  owner.special += g;
  owner.painted += g;
  state.events.push({ type: 'splash', x, y, team: shot.team });
}
