# Better TTFC

東映特撮ファンクラブのPC版サイトをより便利にするためのユーザースクリプト。

> [!WARNING]
> このユーザースクリプトは非公式です。また、これによって発生した問題については一切の責任を負いません。利用は自己責任でお願いします。

## 機能一覧

- トップ画面：「仮面ライダー」などの見出し名をクリックすると作品一覧（「もっと見る」のリンク先）に移動
- 作品一覧：1ページあたりに10作品表示のところを50作品表示に変更
- エピソード一覧：ブラウザを再起動しても視聴履歴が残るように変更

## インストール

1. [Tampermonkey](https://www.tampermonkey.net/)を入れます。
2. [ここ](https://raw.githubusercontent.com/sevenc-nanashi/better-ttfc/built/index.user.js) をクリックして、Tampermonkeyのダッシュボードに追加します。

## 開発

依存関係をインストールするには、以下のコマンドを実行してください：

```bash
bun install
```

開発サーバーを起動するには、以下のコマンドを実行してください：

```bash
bun run dev
```

## ライセンス

MIT Licenseで公開されています。[LICENSE](./LICENSE)ファイルを参照してください。
