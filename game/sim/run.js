// ヘッドレス自動対戦シミュレータ。
//   node sim/run.js [試合数] [チーム0難易度] [チーム1難易度]
// Bot 4体で試合を回し、勝率・塗り率・キル数などを集計してバランスを検証する。
import { C } from '../src/constants.js';
import { createGame, stepGame, coverage } from '../src/engine.js';
import { createBot, botInput } from '../src/bot.js';
import { makeRng } from '../src/rng.js';

const matches = parseInt(process.argv[2] || '100', 10);
const diff0 = parseFloat(process.argv[3] || '0.75');
const diff1 = parseFloat(process.argv[4] || '0.75');
const seedBase = parseInt(process.argv[5] || '1000', 10);

export function runMatch(seed, d0 = 0.75, d1 = 0.75) {
  const state = createGame(seed);
  const botRng = makeRng(seed ^ 0x9e3779b9);
  const bots = state.players.map((p) => createBot(p.id, botRng, p.team === 0 ? d0 : d1));
  const steps = Math.ceil(C.MATCH_TIME / C.TICK) + 2;
  let bursts = 0;
  let starvedTicks = 0; // 生存中プレイヤーのインク枯渇フレーム数
  for (let i = 0; i < steps && !state.over; i++) {
    const inputs = bots.map((b) => botInput(b, state));
    stepGame(state, inputs);
    for (const e of state.events) if (e.type === 'burst') bursts++;
    for (const p of state.players) if (!p.dead && p.ink < C.INK_MIN_TO_FIRE) starvedTicks++;
  }
  const [c0, c1] = coverage(state);
  return {
    c0,
    c1,
    total: c0 + c1,
    winner: c0 > c1 ? 0 : c1 > c0 ? 1 : -1,
    kills: [
      state.players.filter((p) => p.team === 0).reduce((s, p) => s + p.kills, 0),
      state.players.filter((p) => p.team === 1).reduce((s, p) => s + p.kills, 0),
    ],
    deaths: state.players.reduce((s, p) => s + p.deaths, 0),
    bursts,
    starvedSec: (starvedTicks * C.TICK) / 4,
    shotsLeft: state.shots.length,
  };
}

function pct(x) {
  return (x * 100).toFixed(1) + '%';
}

if (process.argv[1] && process.argv[1].endsWith('run.js')) {
  const results = [];
  const t0 = Date.now();
  for (let m = 0; m < matches; m++) results.push(runMatch(seedBase + m * 7919, diff0, diff1));
  const dt = Date.now() - t0;

  const wins = [0, 0, 0];
  let sumTotal = 0;
  let sumC0 = 0;
  let sumC1 = 0;
  let sumMargin = 0;
  let closeGames = 0;
  let sumKills = 0;
  let sumDeaths = 0;
  let sumBursts = 0;
  let sumStarved = 0;
  for (const r of results) {
    wins[r.winner === -1 ? 2 : r.winner]++;
    sumTotal += r.total;
    sumC0 += r.c0;
    sumC1 += r.c1;
    const margin = Math.abs(r.c0 - r.c1);
    sumMargin += margin;
    if (margin < 0.08) closeGames++;
    sumKills += r.kills[0] + r.kills[1];
    sumDeaths += r.deaths;
    sumBursts += r.bursts;
    sumStarved += r.starvedSec;
  }
  const n = results.length;
  console.log(`=== INK RUSH balance sim: ${n} matches (${dt}ms, diff ${diff0} vs ${diff1}) ===`);
  console.log(`win rate       : team0 ${pct(wins[0] / n)} / team1 ${pct(wins[1] / n)} / draw ${pct(wins[2] / n)}`);
  console.log(`avg coverage   : team0 ${pct(sumC0 / n)} + team1 ${pct(sumC1 / n)} = total ${pct(sumTotal / n)}`);
  console.log(`avg margin     : ${pct(sumMargin / n)}  (margin<8%: ${pct(closeGames / n)})`);
  console.log(`avg kills/match: ${(sumKills / n).toFixed(1)}  deaths/match: ${(sumDeaths / n).toFixed(1)}`);
  console.log(`avg specials   : ${(sumBursts / n).toFixed(1)} /match`);
  console.log(`ink-starved    : ${(sumStarved / n).toFixed(1)} s/player/match`);
}
