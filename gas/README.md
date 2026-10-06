# 同期サーバー（GAS）

アプリの記録を Google スプレッドシートに溜め、スマホと PC の記録をそろえる。
あわせて、その日の記録がまだない夜に自分あてにリマインドメールを送る。

- 使うアカウント：**1percent の Google アカウント**（会社アカウントは使わない）
- スプレッドシートは `setup` が自動で作る（記録のシート名は `entries`。設定は最初に変更したときに `settings` シートができる）
- 1行が1日の記録。`id`〜`syncedAt` の右に、入力項目ごとの列（`wins` `learning` `nextAction`）が並ぶ。後から項目を足すと列も右に増える

## スクリプトプロパティ

| 名前 | 内容 | 設定方法 |
|---|---|---|
| `SHARED_SECRET` | 合言葉。アプリの設定画面に同じ値を入れる | `setup` が自動で作る |
| `SPREADSHEET_ID` | 記録を溜めるスプレッドシート | `setup` が自動で作る |
| `APP_URL` | リマインドメールに載せるアプリの URL | 任意。公開後に手で足す |
| `REMIND_HOUR` | リマインドの時刻（0〜23） | 任意。既定は 21。変えたら `setupReminder` を実行し直す |

値はコードにも README にも書かない。

## 初回の手順

clasp は名前付きの認証（`-u onepercent`）を使い、ほかのツールで使っているログインには触れない。
以下のコマンドは `career-journal/gas/` で実行する。

1. 1percent のアカウントで https://script.google.com/home/usersettings を開き、「Google Apps Script API」をオンにする
2. ログインする（ブラウザが開くので 1percent のアカウントを選ぶ）
   ```sh
   clasp -u onepercent login
   ```
3. プロジェクトを作ってコードを送る（`.clasp.json` ができる。gitignore 済み）。
   `create-script` は `src/appsscript.json` を既定の内容（時刻が New York・Web アプリ設定なし）で上書きするので、push の前に git で元に戻す
   ```sh
   clasp -u onepercent create-script --type standalone --title "Career Journal Sync" --rootDir src
   git checkout -- src/appsscript.json
   clasp -u onepercent push --force
   ```
4. エディタを開き、関数 `setup` を選んで実行する。初回は権限の承認を求められる（スプレッドシート・メール送信・トリガー）
   ```sh
   clasp -u onepercent open-script
   ```
   実行ログに「スプレッドシートの URL」と「合言葉」が出る
5. Web アプリとして公開する
   ```sh
   clasp -u onepercent create-deployment --description "v1"
   ```
   表示されたデプロイ ID を使い、`https://script.google.com/macros/s/<デプロイID>/exec` が同期先の URL になる
6. スマホと PC のそれぞれで、アプリの「設定 → スマホとPCの同期」に URL と合言葉を入れる

## コードを直したとき

`clasp push` だけでは公開中の `/exec` は古いまま。同じ URL のまま新しい版にする：

```sh
clasp -u onepercent push
clasp -u onepercent redeploy <デプロイID> --description "v2"
```

## リマインドの時刻を変える

アプリの画面からは変えられない。GAS のエディタで次を行う。

1. 左の「プロジェクトの設定」（歯車）→ スクリプト プロパティで `REMIND_HOUR` を足す（0〜23。例：20）
2. 関数 `setupReminder` を選んで実行する（トリガーが新しい時刻で作り直される）

## 同期の仕組み

- アプリは書いた記録をまず端末（IndexedDB）に保存し、未送信の印を付けて裏で送る
- サーバーは同じ日の記録を `updatedAt` が新しいほうで上書きし（`Logic.gs` の `applySync`）、各行にサーバーの時刻 `syncedAt` を付ける
- アプリは前回受け取った `serverTime` を `since` として送り、それより後に変わった行だけを受け取る。端末の時計がずれていても取りこぼさない
- 入力項目・バッジのしきい値の設定は、`settings` シートの2行目に JSON で1つだけ保存する。更新時刻（`updatedAt`）が新しいほうが残る（`Logic.gs` の `mergeSettings`）。形が不正な設定は保存しない。古い版のアプリは設定を送らないが、それでも動く
- 削除は行を消さず `deleted` 列に `TRUE` を入れる（もう一方の端末に削除を伝えるため）
- シートを手で直すときは `updatedAt` も新しくしないと、端末の古い版で上書きされることがある

## テスト

```sh
npm run test:gas   # Logic.gs の取り込み規則・リマインド判定
npm test           # アプリ側も含めて全部（2台の端末の同期を Logic.gs 相手に確かめる）
```
