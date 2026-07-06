// 全バランスパラメータ。調整はこのファイルに集約する。
export const C = {
  // ワールド
  W: 360,
  H: 640,
  CELL: 8, // 塗りグリッドのセルサイズ(px)
  TICK: 1 / 60, // 固定タイムステップ
  MATCH_TIME: 90, // 試合時間(秒)

  // プレイヤー
  PLAYER_RADIUS: 10,
  SWIM_RADIUS: 6, // 潜行中の被弾半径
  HP_MAX: 100,
  RUN_SPEED: 115, // 通常移動(px/s)
  FIRE_MOVE_SPEED: 82, // 射撃中の移動
  SWIM_SPEED: 215, // 自インク潜行
  ENEMY_INK_SPEED: 48, // 敵インク上
  UNPAINTED_SWIM_SPEED: 70, // 自インク以外で潜行ボタンを押しているとき
  RESPAWN_TIME: 3.0,
  INVULN_TIME: 1.5,

  // 敵インクのスリップダメージ
  ENEMY_INK_DPS: 10,
  ENEMY_INK_HP_FLOOR: 20, // これ未満にはならない

  // インクタンク
  INK_MAX: 100,
  INK_COST_PER_SHOT: 2.0,
  INK_REGEN_STAND: 13, // 毎秒
  INK_REGEN_SWIM: 50, // 自インク潜行中 毎秒
  INK_MIN_TO_FIRE: 2.0,

  // 射撃
  FIRE_INTERVAL: 0.14,
  SHOT_SPEED: 330,
  SHOT_RANGE: 150,
  SHOT_RADIUS: 4,
  SHOT_DAMAGE: 24,
  SHOT_SPREAD: 0.13, // 発射角ノイズ(rad)
  DROPLET_SPACING: 26, // 飛沫を落とす間隔(px)
  DROPLET_PAINT_RADIUS: 7,
  SPLASH_PAINT_RADIUS: 13, // 着弾スプラッシュ

  // スペシャル「インクバースト」
  SPECIAL_POINTS: 1100, // 塗りポイント(新規セル数)で満タン
  SPECIAL_PAINT_RADIUS: 58,
  SPECIAL_DAMAGE: 70,
  SPECIAL_DAMAGE_RADIUS: 46,

  // チーム
  TEAM_COLORS: [
    { main: '#ff7a1a', bright: '#ffb066', dark: '#c25200', name: 'オレンジ' },
    { main: '#2bd4c4', bright: '#8ff0e6', dark: '#0f9487', name: 'ターコイズ' },
  ],
};
