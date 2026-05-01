# CLAUDE.md

このファイルは、Claude Code (claude.ai/code) がこのリポジトリで作業する際のガイダンスを提供します。

## プロジェクト概要

**rakurun** — ランニング × 位置ゲー × クラフトのスマホアプリ。

GPSでランニングを記録しながら、途中でアイテムを拾ったりモンスターとバトルしたりする。走った経路で囲んだ領域を「陣地」として確保でき、その中で牧場・農耕などのクラフトコンテンツを楽しめる。

## 技術スタック

- **モバイル**: React Native + Expo (TypeScript)
- **地図**: react-native-maps (Google Maps プロバイダ)
- **位置情報**: expo-location
- **状態管理**: Zustand
- **バックエンド**: Supabase (Postgres + Auth + Realtime)
- **永続化**: AsyncStorage (Supabaseセッション用)

## 開発コマンド

```bash
npm install                  # 依存関係のインストール
npm start                    # Expo dev server 起動
npm run ios                  # iOSシミュレータで起動 (macOSのみ)
npm run android              # Androidエミュレータ/実機で起動
npm run web                  # Webブラウザで起動 (地図機能は限定的)
npm run typecheck            # TypeScript型チェック
```

実機確認は Expo Go アプリで `npm start` 後にQRコードを読み取り。

## プロジェクト構成

```
/
├── App.tsx                  # ルートコンポーネント
├── index.ts                 # Expoエントリーポイント
├── app.json                 # Expo設定 (パーミッション、プラグイン)
├── src/
│   ├── screens/             # 画面コンポーネント
│   │   └── MapScreen.tsx    # メイン地図画面
│   ├── components/          # 再利用可能なUIコンポーネント
│   ├── hooks/               # カスタムフック
│   │   └── useLocationTracking.ts
│   ├── lib/                 # ロジック層
│   │   ├── geo.ts           # 距離・面積計算 (Haversine, 球面ポリゴン)
│   │   ├── territory.ts     # 陣地検出ロジック
│   │   └── supabase.ts      # Supabaseクライアント
│   ├── store/               # Zustand ストア
│   │   └── runStore.ts
│   └── types/               # 型定義
└── assets/                  # アイコン等の静的リソース
```

## MVP スコープ (現在)

- [x] GPSによるランニング軌跡の記録
- [x] 地図上に経路を描画
- [x] 走った経路で閉ループを検出 → 陣地ポリゴン化
- [x] 陣地の地図表示
- [ ] Supabaseへの保存・同期
- [ ] 認証 (Supabase Auth)

## 今後の拡張 (Roadmap)

1. **アイテム収集**: マップ上にスポーンするアイテムを通過時に取得
2. **モンスターバトル**: 遭遇画面、シンプルなターン制
3. **クラフト/牧場**: 自陣地内で建物配置、農作物の植え付け・収穫
4. **オンライン要素**: 他プレイヤーの陣地表示、PvP
5. **バックグラウンド追跡**: アプリを閉じてもラン記録継続

## 重要な実装上の注意

### 位置情報パーミッション

iOS/Androidで位置情報の使用説明文 (`Info.plist`/`AndroidManifest.xml`) は `app.json` の以下に記載:
- iOS: `expo.ios.infoPlist.NSLocationWhenInUseUsageDescription` 等
- Android: `expo.android.permissions`
- プラグイン: `expo-location` をプラグインに登録済み

### Google Maps APIキー

Androidでは `app.json` の `expo.android.config.googleMaps.apiKey` にキー設定が必要。
iOSは Apple Maps が標準で動作するが、`PROVIDER_GOOGLE` 利用時はキー必須。

### Supabase 接続情報

`app.json` の `expo.extra.supabaseUrl` / `supabaseAnonKey` から読み込み。
コミットしないために、本番では `eas.json` の env 経由で渡すのが推奨。
ローカル開発中は `app.json` を直接書き換え、コミット前に空に戻すこと。

### 陣地検出ロジック (`src/lib/territory.ts`)

走行経路の最後の点が、過去の点と一定距離以内 (デフォルト30m) に近づいたら閉ループと判定。
最低8点以上ないとポリゴン化しない (誤検知防止)。

### 距離・面積計算 (`src/lib/geo.ts`)

- 距離: Haversine 公式 (球面距離)
- 面積: 球面ポリゴンの近似式 (短距離向け、km²オーダーまで実用)

## テスト

未整備。テスト追加時は Jest + React Native Testing Library を導入予定。

## コーディング規約

- TypeScript strict モード
- 関数コンポーネント + Hooks
- ファイル名: コンポーネントは PascalCase、それ以外は camelCase
- 1ファイル1主要エクスポート
