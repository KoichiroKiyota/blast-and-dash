<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Blast & Dash

ボンバーマン風のゲームです。敵を倒して出口を見つけて次のレベルに進みましょう！

🎮 **プレイする**: [https://kiyota.github.io/blast-and-dash/](https://kiyota.github.io/blast-and-dash/)

## ゲームの遊び方

- **移動**: 矢印キーまたはWASDキー
- **爆弾設置**: スペースキー
- **目標**: すべての敵を倒して出口を見つける

## ローカルで実行する

**前提条件:** Node.js

1. 依存関係をインストール:
   ```bash
   npm install
   ```

2. アプリを実行:
   ```bash
   npm run dev
   ```

## GitHub Pagesでデプロイする

このプロジェクトは自動的にGitHub Pagesにデプロイされます。

### 手動デプロイ

1. 依存関係をインストール:
   ```bash
   npm install
   ```

2. デプロイ:
   ```bash
   npm run deploy
   ```

### 自動デプロイ

- `main`ブランチにプッシュすると、GitHub Actionsが自動的にビルドしてGitHub Pagesにデプロイします
- デプロイが完了すると、数分後に https://kiyota.github.io/blast-and-dash/ でアクセスできます

## 技術スタック

- React 19
- TypeScript
- Vite
- Tailwind CSS
- GitHub Pages
- GitHub Actions
