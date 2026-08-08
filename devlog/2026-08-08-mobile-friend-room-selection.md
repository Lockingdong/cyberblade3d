# 2026-08-08 好友房進房後選陀螺（第三段：Mobile）

第一段（Go + Web）見 [2026-08-07-friend-room-blade-selection.md](2026-08-07-friend-room-blade-selection.md)，第二段（Mobile 零件工坊）見 [2026-08-08-mobile-part-customizer.md](2026-08-08-mobile-part-customizer.md)。這一段把 Web 已經有的好友房選角流程補到 Mobile，三段計畫到此收尾。

## 今天做了什麼

- `apps/mobile/App.tsx` 的 `OnlineSelection` 比照 Web 拆成 `select` / `power` 兩個子畫面。`select` 沿用主選單既有的 `BladePreviewScene`、`BladePicker`、`GarageButton`、`ColorPalette`，沒有另寫一套選角 UI；`power` 是原本那個力道計畫面，多一顆「返回重選陀螺」。
- 只有 `online.roomKind === "friend"` 才有 `select` 這一步，快速配對直接進 `power`，行為與改動前完全相同。
- `powerActive` 從 `online.phase === "matched"` 改成 `online.phase === "matched" && prepStep === "power"`，選陀螺時力道計不再空轉。
- `readyOnline` 補送 `bladeId` / `ratchetId` / `bitId` / `chipId`，取自第二段建立的 `currentConfig`。在這之前 Mobile 完全不送零件，所以 Web 對手看到的是庫存造型。
- 對手在選角期間離開時強制關閉零件工坊，比照 Web 的同一個 effect。
- `shouldHostLeaveForAppState` 拿掉 `matched` / `waiting_ready`，並補兩則測試。
- 結果頁再戰按鈕在好友房顯示「再戰（可重選陀螺）」；建房畫面「他加入後就會自動開始」改成「他加入後你們就能各自挑選陀螺」。

## 遇到的問題 / 解法

- 問題：Web 用 `key={online.matchId}` 重新掛載 `OnlineSelection` 就能讓再戰回到選角，Mobile 不能照抄。Mobile 的 `power` 是 App 層的 state、由 App 層的 `setInterval` 驅動，`powerActive` 要看得到目前是哪一步，所以 step 必須提升到 App。
  - 解法：step 放 App，但**在 render 期間**用一個 ref 比對 `online.matchId` 來重置，而不是用 effect。effect 會晚一個 frame，那一個 frame 足以讓力道計在玩家已經離開的畫面上先擺一下。
  - 另外把 `prepStep` 寫成 `canSelectBlade ? friendPrepStep : "power"`，快速配對永遠不經過 `select`，連一個 frame 的閃動都不會有。
- 問題：`shouldHostLeaveForAppState` 原本涵蓋 `matched` / `waiting_ready`，host 一切到背景就離房。這正是第一段在 Web 上踩過的坑（`visibilitychange`），只是 Mobile 這邊是 `AppState`。好友房的準備窗口現在有 5 分鐘，host 切出去把房號傳給朋友就會把房間解散，而且朋友只看到「對手已離開」。
  - 解法：只保留 `countdown` / `battle` / `ending`。傳房號本身就是這個流程的必要動作，不能是離房的理由。
- 問題：Mobile 送出的 `name` 還是 `BEYBLADES[playerType].name`，不是玩家在工坊裡改過的名字。
  - 現況：維持不動。名稱與顏色照原本的決策留在主選單，這次只補零件 id。

## 決策紀錄

- 決定：step 提升到 App 層，用 render 期間重置取代 `key` remount。
  - 原因：Mobile 的力道計是 App 層的 interval，元件內部的 state 拿不到。
  - 放棄的選項：用 effect 回報 step 給 App——會晚一個 frame，再戰瞬間力道計會先動起來。
- 決定：`select` 步驟直接複用主選單的四個元件。
  - 原因：與 Web 同一個理由——房內的選擇本來就要跟主選單共用 state 並寫回儲存，用同一組元件才不會有兩套行為。

## 驗證

- `task check` 全綠（typecheck + 測試 + Go 測試）。`apps/mobile` 測試從 5 則增為 7 則。
- **互動流程仍未驗收。** iOS Simulator 這次能開了（`sudo xcode-select -s` 之後 `/var/db/xcode_select_link` 存在，MCP 工具可以 attach），app 也正常啟動、可以捲動、Expo Go 的開發者選單能開，但**注入的 tap 幾乎進不到 app ScrollView 裡的 `Pressable`**：十幾次點擊只有一次成功（切換陀螺）。同一個問題也發生在改動前就存在的 `ColorPalette` 與 `Action` 上，所以不是這次改動造成的。
  - 待人工驗收：好友房兩端進房後停在選角、換陀螺與零件後「確定出戰」、對戰畫面兩邊看到的模型一致、再戰回到選角、選角停留超過 60 秒不被踢、快速配對維持單頁力道計。

## 下一步

- 人工跑一次 Mobile ↔ Web 的好友房，把上面那串驗收項目補完。
- Mobile 的玩家名稱與戰績仍是 session-only，與零件持久化不一致；要不要一起補進 AsyncStorage 還沒決定。
- `ready` 裡硬寫的 `stadium: "neon"` 是死欄位，伺服器不讀，兩端都還留著。

## 相關

- 計畫與決策全表：[2026-08-07-friend-room-blade-selection.md](2026-08-07-friend-room-blade-selection.md)
