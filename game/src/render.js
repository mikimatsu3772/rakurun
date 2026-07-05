import { C } from './constants.js';
import { OBSTACLES, GRID_W, GRID_H } from './map.js';

// Canvas 2D 描画。塗りグリッドは低解像度オフスクリーンに描いて拡大し、
// インクらしい柔らかいエッジを出す。

function hexToRgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const ink = document.createElement('canvas');
  ink.width = GRID_W;
  ink.height = GRID_H;
  const inkCtx = ink.getContext('2d');
  const inkImg = inkCtx.createImageData(GRID_W, GRID_H);

  const GROUND = [38, 38, 52];
  const palette = [GROUND, hexToRgb(C.TEAM_COLORS[0].main), hexToRgb(C.TEAM_COLORS[1].main), [22, 22, 30]];

  let particles = [];
  let shake = 0;

  function addEvents(events, myId) {
    for (const e of events) {
      const col = C.TEAM_COLORS[e.team];
      if (e.type === 'splash') {
        particles.push({ type: 'ring', x: e.x, y: e.y, r: 4, dr: 60, life: 0.25, t: 0, color: col.bright, lw: 2 });
      } else if (e.type === 'kill') {
        particles.push({ type: 'ring', x: e.x, y: e.y, r: 6, dr: 160, life: 0.5, t: 0, color: col.main, lw: 5 });
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          particles.push({
            type: 'blob', x: e.x, y: e.y, vx: Math.cos(a) * (40 + 60 * Math.random()),
            vy: Math.sin(a) * (40 + 60 * Math.random()), r: 3 + Math.random() * 4, life: 0.6, t: 0, color: col.main,
          });
        }
        if (e.victim === myId) shake = 0.35;
      } else if (e.type === 'burst') {
        particles.push({ type: 'ring', x: e.x, y: e.y, r: 10, dr: (C.SPECIAL_PAINT_RADIUS - 10) / 0.4, life: 0.4, t: 0, color: col.bright, lw: 8 });
        shake = Math.max(shake, 0.25);
      }
    }
  }

  function drawInk(state) {
    const d = inkImg.data;
    const g = state.grid;
    for (let i = 0; i < g.length; i++) {
      const p = palette[g[i]];
      const j = i * 4;
      d[j] = p[0];
      d[j + 1] = p[1];
      d[j + 2] = p[2];
      d[j + 3] = 255;
    }
    inkCtx.putImageData(inkImg, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(ink, 0, 0, GRID_W, GRID_H, 0, 0, C.W, C.H);
  }

  function drawObstacles() {
    for (const [x, y, w, h] of OBSTACLES) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x + 3, y + 4, w, h);
      ctx.fillStyle = '#4a4a63';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#5d5d7d';
      ctx.fillRect(x, y, w, 5);
    }
  }

  function drawPlayer(p, myId, time) {
    if (p.dead) return;
    const col = C.TEAM_COLORS[p.team];
    const blink = p.invulnT > 0 && Math.floor(time * 10) % 2 === 0;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.globalAlpha = blink ? 0.35 : 1;
    const ang = Math.atan2(p.faceY, p.faceX);
    if (p.swimming) {
      // イカ潜行: 進行方向に伸びた雫形
      ctx.rotate(ang);
      ctx.fillStyle = col.dark;
      ctx.beginPath();
      ctx.ellipse(0, 0, 13, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = col.bright;
      ctx.beginPath();
      ctx.ellipse(3, 0, 6, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // 本体
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.arc(1.5, 2.5, C.PLAYER_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = col.main;
      ctx.beginPath();
      ctx.arc(0, 0, C.PLAYER_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      // 頭のトンガリ (向き)
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(C.PLAYER_RADIUS + 6, 0);
      ctx.lineTo(2, -7);
      ctx.lineTo(2, 7);
      ctx.closePath();
      ctx.fillStyle = col.dark;
      ctx.fill();
      // 目
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(4, -4, 3.2, 0, Math.PI * 2);
      ctx.arc(4, 4, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a1a24';
      ctx.beginPath();
      ctx.arc(5.2, -4, 1.6, 0, Math.PI * 2);
      ctx.arc(5.2, 4, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 自機マーカー + インクリング + HPリング
    if (p.id === myId) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, C.PLAYER_RADIUS + 7, -Math.PI / 2, -Math.PI / 2 + (p.ink / C.INK_MAX) * Math.PI * 2);
      ctx.stroke();
      if (p.hp < C.HP_MAX) {
        ctx.strokeStyle = p.hp < 40 ? '#ff4455' : 'rgba(120,255,120,0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, C.PLAYER_RADIUS + 11, -Math.PI / 2, -Math.PI / 2 + (p.hp / C.HP_MAX) * Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  function drawShots(state) {
    for (const s of state.shots) {
      const col = C.TEAM_COLORS[s.team];
      ctx.fillStyle = col.bright;
      ctx.beginPath();
      ctx.arc(s.x, s.y, C.SHOT_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = col.main;
      ctx.beginPath();
      ctx.arc(s.x - s.vx * 0.02, s.y - s.vy * 0.02, C.SHOT_RADIUS * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawParticles(dt) {
    const keep = [];
    for (const pt of particles) {
      pt.t += dt;
      if (pt.t < pt.life) keep.push(pt);
      else continue;
      const k = pt.t / pt.life;
      ctx.globalAlpha = 1 - k;
      if (pt.type === 'ring') {
        ctx.strokeStyle = pt.color;
        ctx.lineWidth = pt.lw * (1 - k) + 0.5;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.r + pt.dr * pt.t, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.r * (1 - k * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    particles = keep;
  }

  function drawMeter(state) {
    const [c0, c1] = [state.counts[0] / state.paintable, state.counts[1] / state.paintable];
    const x0 = 14;
    const x1 = C.W - 14;
    const w = x1 - x0;
    const y = 14;
    const h = 12;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(x0 - 3, y - 3, w + 6, h + 6, 8);
    ctx.fill();
    ctx.fillStyle = '#55556d';
    roundRect(x0, y, w, h, 5);
    ctx.fill();
    ctx.fillStyle = C.TEAM_COLORS[0].main;
    if (c0 > 0) {
      roundRect(x0, y, Math.max(6, w * c0), h, 5);
      ctx.fill();
    }
    ctx.fillStyle = C.TEAM_COLORS[1].main;
    if (c1 > 0) {
      roundRect(x1 - Math.max(6, w * c1), y, Math.max(6, w * c1), h, 5);
      ctx.fill();
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawTimer(state) {
    const remain = Math.max(0, C.MATCH_TIME - state.time);
    const s = Math.ceil(remain);
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.fillStyle = remain < 10 ? '#ff5566' : '#ffffff';
    const label = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    ctx.strokeText(label, C.W / 2, 34);
    ctx.fillText(label, C.W / 2, 34);
  }

  function drawButton(b, active, label, sub, fill) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = active ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.14)';
    ctx.fill();
    if (fill !== undefined) {
      // ゲージ扇形
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.arc(b.x, b.y, b.r - 2, -Math.PI / 2, -Math.PI / 2 + fill * Math.PI * 2);
      ctx.closePath();
      ctx.fillStyle = fill >= 1 ? 'rgba(255,235,80,0.85)' : 'rgba(255,255,255,0.25)';
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = fill >= 1 ? '#332b00' : '#ffffff';
    ctx.font = `bold ${Math.round(b.r * 0.42)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, b.x, b.y - (sub ? 5 : 0));
    if (sub) {
      ctx.font = `${Math.round(b.r * 0.26)}px system-ui, sans-serif`;
      ctx.fillText(sub, b.x, b.y + b.r * 0.34);
    }
  }

  function drawJoystick(joy) {
    if (!joy.active) return;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(joy.ox, joy.oy, 44, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.arc(joy.ox + joy.dx * 44, joy.oy + joy.dy * 44, 20, 0, Math.PI * 2);
    ctx.fill();
  }

  // メインの描画: 試合画面
  function drawMatch(state, ui, dt) {
    ctx.save();
    if (shake > 0) {
      shake = Math.max(0, shake - dt);
      const s = shake * 12;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }
    drawInk(state);
    drawObstacles();
    drawShots(state);
    // スポーン地点マーカー
    for (let t = 0; t < 2; t++) {
      ctx.strokeStyle = C.TEAM_COLORS[t].bright;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(180, t === 0 ? 606 : 34, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    for (const p of state.players) drawPlayer(p, ui.myId, state.time);
    drawParticles(dt);
    ctx.restore();

    drawMeter(state);
    drawTimer(state);

    if (!ui.auto) {
      const me = state.players[ui.myId];
      drawJoystick(ui.joy);
      drawButton(ui.buttons.fire, ui.buttons.fire.held, 'FIRE', null);
      drawButton(ui.buttons.swim, ui.buttons.swim.held, 'SWIM', null);
      drawButton(ui.buttons.special, false, 'SP', null, Math.min(1, me.special / C.SPECIAL_POINTS));
      if (me.dead) {
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(0, 0, C.W, C.H);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 30px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('やられた…', C.W / 2, C.H / 2 - 20);
        ctx.font = '20px system-ui, sans-serif';
        ctx.fillText(`復活まで ${Math.ceil(me.respawnT)}`, C.W / 2, C.H / 2 + 16);
      }
    }
  }

  function clear() {
    ctx.fillStyle = '#1c1c28';
    ctx.fillRect(0, 0, C.W, C.H);
  }

  return { ctx, clear, drawMatch, addEvents, roundRect, drawButton };
}
