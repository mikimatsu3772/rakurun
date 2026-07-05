# rakurun

ランニング × 位置ゲー × クラフトのスマホアプリ。

GPSでランニングを記録しながらアイテムを拾い、モンスターとバトルし、走って囲んだ領域を「陣地」として、その中で牧場・農耕などのクラフトを楽しめる。

## 技術スタック

- React Native + Expo (TypeScript)
- react-native-maps / expo-location
- Zustand (状態管理)
- Supabase (バックエンド)

## クイックスタート

```bash
npm install
npm start
```

実機で動かす場合は Expo Go アプリで QR を読む。

## ミニゲーム: INK RUSH

`game/` にスマホブラウザで遊べる陣取りインクシューター (スプラトゥーン風 2D) が入っている。

```bash
cd game && python3 -m http.server 8000   # → スマホで http://<PCのIP>:8000
```

または `game/dist/inkrush.html` 1ファイルをスマホに送って開くだけでも遊べる。
詳細は [game/DESIGN.md](game/DESIGN.md)、バランス調整の記録は [game/BALANCE.md](game/BALANCE.md)。

## 開発状況

MVPフェーズ:
- [x] GPSランニング記録
- [x] 経路の地図描画
- [x] 閉ループ検出 → 陣地化
- [ ] Supabase連携
- [ ] アイテム / モンスター / クラフト

## ライセンス

未定 (開発中)
