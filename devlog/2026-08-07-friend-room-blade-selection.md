# 2026-08-07 好友房進房後選陀螺（第一段：Go + Web）

## 今天做了什麼

- 釐清「好友房一進房就開打」的實際狀況：`matched` 階段本來就有準備畫面，但畫面上只有發射力道計，陀螺是主選單挑好的、進房不能改。
- 確認線上協定早就支援這件事：`ReadySelection` 已含 `blade / bladeId / ratchetId / bitId / chipId / name / color`，Web 也已經在送；再戰的 `restartRoom` 也是打回 `matched` 重新收 `ready`。因此核心需求是 client UI 改動，protocol 與 `PROTOCOL_VERSION` 都不動。
- `services/api/internal/matchmaking/hub.go`：`Config` 新增 `FriendReadyTimeout`（預設 5 分鐘），`armReadyTimer` 依 `room.code != ""` 分流；快速配對維持 60 秒。因為 `restartRoom` 不清 `code`，再戰自動吃到同一個放寬值。
- `packages/multiplayer/src/online-match-coordinator.ts`：`OnlineMatchState` 新增 `roomKind: "quick" | "friend"`，由 `#intent` 推導，並在 `joinQueue` / `createRoom` / `joinRoom` 三個入口各自標記。
- `apps/web/src/App.tsx`：`OnlineSelection` 拆成「選陀螺／改裝」與「鎖定力道」兩個子畫面，好友房才有第一步；力道計改為只在第二步擺盪；以 `key={online.matchId}` 重新掛載，讓再戰回到第一步。
- 選角步驟直接複用 `BladePicker`、`BladePreviewScene`、`BladeDetails` 與 `PartCustomizerModal`，沒有新寫一套選角 UI。
- 補測試：`server_test.go` 兩則好友房 timeout 分支、`online-match-coordinator.test.ts` 的 `roomKind`、`apps/web/src/online.test.ts` 的 `hostShouldLeaveWhenHidden`。

## 遇到的問題 / 解法

- 問題：`matched` 訊息沒有房號也沒有好友旗標，coordinator 又在收到 `matched` 時把 `roomCode` 清成 `null`，UI 在準備階段分不出快速配對與好友房。
  - 解法：用 client 端既有的 `#intent` 推導 `roomKind`，不改協定、TS 與 Go 不需同步。
- 問題：`roomKind` 只在 `connect()` 設定會有殘留。輸錯房號會停在 `lobby` 並保留 socket，下一次改選隨機配對不會重新 `connect()`，`roomKind` 就還是 `friend`。
  - 解法：改成 `joinQueue` / `createRoom` / `joinRoom` 三個入口各自標記，`connect()` 只是先行給值。
- 問題（驗證時才撞到，最麻煩的一個）：`apps/web/src/App.tsx` 的 `visibilitychange` 會讓 host 分頁一切到背景就離房，判斷用的 `isActiveOnlineRoom` 把 `matched` / `waiting_ready` 也算進去。以前 `matched` 只有幾秒所以無害，窗口拉長到 5 分鐘後，host 選陀螺選到一半切個分頁，房間就沒了，而且對方只看到「對手已離開」。
  - 解法：新增 `hostShouldLeaveWhenHidden`，只涵蓋 `countdown` / `battle` / `ending`。不直接改 `isActiveOnlineRoom`，因為 `onlinePageExitAction`（pagehide / beforeunload，分頁真的關掉）仍然應該從 `matched` 離房。
- 問題：`PartCustomizerModal` 掛在頂層、不受 phase 條件控制，對手在選角期間離開時工坊會蓋在終止畫面上。
  - 解法：加一個 effect，離開 `matched` / `waiting_ready` 時強制關閉。
- 問題：建房畫面文案「他加入後就會自動開始」已經不成立。
  - 解法：Web 改成「他加入後就能各自挑選陀螺」。Mobile 那句暫時保留，因為 Mobile 這段還沒做，現況仍然是自動開始。

## 決策紀錄

- 決定：只改好友房，快速配對完全不動。
  - 原因：陌生人配對不適合讓對方乾等 5 分鐘。
  - 代價：準備畫面有兩種型態、伺服器有兩種 timeout，之後動這個畫面要顧兩條路。
- 決定：伺服器依 `room.code` 區分，好友房 ReadyTimeout 放寬到 5 分鐘。
  - 原因：60 秒不夠翻 10 顆陀螺再開工坊調 4 個部件，逾時的懲罰是整個房間解散、房號作廢。
  - 放棄的選項：不改伺服器只在前端顯示倒數並自動送出（會逼人開戰）；好友房完全取消 timeout（少一道回收保險）。
- 決定：準備階段拆成兩步，力道計只在第二步擺盪。
  - 原因：力道鎖定是看時機的小遊戲，選陀螺時讓它空轉會變成純運氣。
  - 放棄的選項：同一畫面、翻輪播時暫停力道計（暫停規則難直覺，手機窄螢幕也塞不下）。
- 決定：維持盲選，對手的選擇到 `start` 才揭曉。
  - 原因：零協定改動，也避開「後選者有利」的公平性問題；好友面對面想互相告知可以自己講。
- 決定：鎖定後不能取消準備。
  - 原因：盲選之下沒有情報理由改主意，好友房兩人本來就會互相催；`unready` 要在 TS 與 Go 都加訊息、驗證與測試，還要防反覆鎖／解鎖刷對手。
- 決定：房間內的選擇與主選單共用同一份 state，會寫回 localStorage。
  - 原因：只有一個「我現在的陀螺」概念最單純，不用多維護一層臨時 state。
  - 代價：房內臨時換招會蓋掉平常配置。
- 決定：再戰維持雙方同意的兩層確認，只把好友房的按鈕文案改成「再戰（可重選陀螺）」。
  - 原因：伺服器的 rematch 本來就需要互相同意，跳過會讓想離開的人被卡住。
- 決定：對手在選角期間離開維持現狀（顯示已離開 → 回主選單，房號作廢）。
  - 放棄的選項：保留房號等對方重連（要改 Go 的房間生命週期，是獨立題目）。
- 決定：選角階段不讓背景中的 host 離房，戰鬥階段維持原樣。
  - 原因：選角時 host 沒在跑物理模擬，背景不會卡住對手，伺服器 5 分鐘 timeout 就是保險；倒數之後 host 是權威端，分頁隱藏會停 `requestAnimationFrame`，讓 guest 畫面凍住，那時離房才是對的。

## 驗證

- `task check` 全綠（Go 測試 + 9 個 workspace 的 typecheck 與測試）。
- 瀏覽器雙分頁實測（`task dev:api` + `dev:web`）：
  - 建房 → 邀請連結加入 → 雙方都停在「選擇出戰陀螺」。
  - 房內換陀螺、開工坊換 blade，3D 預覽與數值差異即時更新。
  - 確定出戰 → 力道頁；返回重選陀螺保留選擇；鎖定後按鈕 disabled，文案為「你的發射資料已鎖定，等待對手選角」。
  - 選擇確實進到 `start`：host 選耀陽神隼、guest 選翡翠幻獸，倒數畫面各自看到對方的新選擇。
  - 房間停在選角超過 60 秒仍存活。
  - host 分頁 `visibilityState: hidden` 時仍留在房內。
  - 對手離開時工坊自動關閉，終止畫面完整可見。
  - 快速配對維持原樣：直接進力道計，無選角步驟、無「返回重選陀螺」。
- 未能手動驗證：再戰 → 回選角。瀏覽器工具的分頁一律回報 `hidden`，`requestAnimationFrame` 被凍結，host 的模擬跑不動所以打不完一場。目前靠 coordinator 單元測試（`roomKind` 在 rematch 後仍為 `friend`）與 `key={matchId}` 重新掛載覆蓋，UI 邏輯與第一場完全共用。需要在真實瀏覽器開兩個視窗補這一項。

## 下一步

- 第二段：Mobile 零件工坊。把 `resolveCustomConfig` 下沉到 `packages/core`、預覽鏡頭座標下沉到 `packages/visuals`；Mobile `BladePreviewScene` 接上 `customSpec`（`BeybladePreviewWorld` 建構子已支援）；移植 RN 版工坊與圖示；引入 `react-native-svg` 與 `@react-native-async-storage/async-storage`。
- 第三段：Mobile 好友房選角。`OnlineSelection` 拆兩步、`powerActive` 只在力道步驟為 true、`readyOnline` 補送四個零件 id，並更新 Mobile 建房畫面那句「自動開始」。
- 待補驗證：真實瀏覽器雙視窗打完一場，確認再戰回到選角。

## 備註

- `ready` 訊息帶的 `stadium` 是死欄位：兩端都硬寫 `"neon"`，伺服器 `startRoom` 完全不讀它，場館由 `pickRandomStadium()` 決定。這次只記錄，沒有動。
- Mobile 的玩家名稱與戰績仍是 session-only，第二段只會補零件配置的持久化，不順手改其他兩項。

## 相關

- 主要責任層：`services/api/internal/matchmaking/hub.go`、`packages/multiplayer/src/online-match-coordinator.ts`、`apps/web/src/App.tsx`、`apps/web/src/online.ts`。
- design_docs：無。
