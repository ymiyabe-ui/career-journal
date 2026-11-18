# 同期サーバー（GAS）

アプリの記録を Google スプレッドシートに溜め、スマホと PC の記録をそろえる。
あわせて、その日の記録がまだない夜に自分あてにリマインドメールを送る。

- 使うアカウント：**1percent の Google アカウント**（会社アカウントは使わない）
- スプレッドシートは `setup` が自動で作る（記録のシート名は `entries`。設定は最初に変更したときに `settings` シートができる）
- 1行が1日の記録。`id`〜`syncedAt` の右に、入力項目ごとの列（`wins` `learning` `nextAction`）が並ぶ。後から項目を足すと列も右に増える
- メモは `memos` シートに1行1件で入る。中身（本文・仕事/日常・印）は端末で暗号化してから届くので、`iv` と `ct` の列は読めない文字列になる。読めるのは日付と時刻だけ

## スクリプトプロパティ

| 名前 | 内容 | 設定方法 |
|---|---|---|
| `SHARED_SECRET` | 合言葉。アプリの設定画面に同じ値を入れる | `setup` が自動で作る |
| `SPREADSHEET_ID` | 記録を溜めるスプレッドシート | `setup` が自動で作る |
| `APP_URL` | リマインドメールに載せるアプリの URL | 任意。公開後に手で足す |
| `REMIND_HOUR` | リマインドの時刻（0〜23） | 任意。既定は 21。変えたら `setupReminder` を実行し直す |
| `MEMO_KEY` | メモの鍵の材料（salt と、合言葉が合っているかの確かめ用の暗号文）。合言葉そのものではない | アプリで最初に合言葉を決めた端末が送ったものを自動で保存する。手で変えない |

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
- メモも同じ規則（`Logic.gs` の `applyMemoSync`）で取り込む。メモの鍵の材料 `MEMO_KEY` は、最初に届いたものを全端末の鍵にし、後から別の材料が届いても置き換えない（`chooseMemoKey`）。アプリは自分の鍵が `MEMO_KEY` と同じと確かめてからメモを送る
- 古い版のサーバーはメモを返さない。そのときアプリはメモを端末にだけ残し、サーバーを新しい版にしたあとの同期でまとめて送る

## メモの合言葉を忘れたとき

合言葉はどこにも保存していないので、メモは戻せない。決め直すときは次の順に行う（達成・学びの記録は消えない）。

1. GAS のエディタで「プロジェクトの設定」→ スクリプト プロパティの `MEMO_KEY` を消す
2. スプレッドシートの `memos` シートを消す（次の同期で空のシートが作り直される）
3. 各端末のアプリで「設定 → メモの暗号化 → 合言葉を忘れたとき：この端末のメモを消す」を押す（合言葉を入れていない端末にだけ出る。達成・学びの記録は消えない）
4. どれか1台で合言葉を決め直し、ほかの端末ではその合言葉を入れる

## テスト

```sh
npm run test:gas   # Logic.gs の取り込み規則・リマインド判定
npm test           # アプリ側も含めて全部（2台の端末の同期を Logic.gs 相手に確かめる）
```
