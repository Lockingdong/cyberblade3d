# CyberBlade 3D：好友房與房內再戰

> 2026-08-03 實作完成。本文記錄設計決策；現況以程式碼與 AGENTS.md 為準。

## 目標

在既有的陌生人 FIFO 配對之外，加入「跟朋友對戰」：一方建房拿到 6 碼房號，另一方
輸入房號或點邀請連結即可加入。同時支援對戰結束後在同一間房再戰一場。

## 已確認的決策

- 好友房只換掉「配對來源」，`matched` 之後的流程與隨機配對完全共用，
  `simulation`、`visuals`、`snapshot-timeline` 不受影響。
- 建房者恆為 host（p1），加入者為 guest（p2）。
- 房號 6 碼，字母表排除 I、L、O、0、1，以 `crypto/rand` 產生並做拒絕取樣避免偏差。
- 房號存活 10 分鐘（`RoomCodeTTL`）；被兌換後立即從表中移除。
- 再戰對**隨機配對房與好友房一視同仁**：伺服器是同一段邏輯。若日後只想開放給好友房，
  在 `hub.rematch` 加上 `current.code != ""` 判斷即可。
- 再戰用**新的 matchId**，不重用舊房 id。
- Mobile 不做 deep link；分享訊息帶房號，若設定了 `EXPO_PUBLIC_INVITE_BASE_URL`
  再附上 Web 版連結。

## 為什麼再戰要換新的 matchId

兩端 App 以 matchId 當作「這局是否已處理過」的 key（`preparedMatch`、
`launchedMatch`、`endingSentMatch`、`resultSentMatch`），`MatchmakingClient` 也在收到
`matched` 時重置 `seq` / `eventId`。沿用舊 id 會讓上一局的殘留訊框被視為本局資料；
換新 id 則讓所有既有的去重機制自然歸零。伺服器在重啟房間時會把舊 id 記入
`rememberMatch`，因此遲到的舊訊框仍會被靜默丟棄。

## 房間生命週期

```text
matched -> countdown -> battle -> ending -> finished
                                              │
                    雙方 rematch ─────────────┤─> matched（新 matchId）
                    離開／斷線／window 逾時 ──┴─> opponent_left + 關房
```

`finished` 期間不接受任何戰鬥訊息。`authorizedHost` 在此 phase 靜默丟棄 state、
battle_event 與重複的 match_end——這些遲到訊框是正常現象，不應回傳錯誤把對方的
結果畫面打成錯誤畫面。

## 協定 v5

新增 client → server：`create_room`、`join_room`、`rematch`。
新增 server → client：`room_created`、`opponent_rematch`。
`cancel_queue` 語意擴充為「取消目前等待中的配對（排隊或未被加入的好友房）」。
`opponent_left` 的 phase 列舉新增 `finished`。

錯誤碼：`ROOM_NOT_FOUND`、`ROOM_EXPIRED`、`ROOM_SELF`、`SERVER_BUSY` 被 client 視為
**可回復**——連線保留、狀態退回 `lobby`，玩家可以直接重打房號；其餘錯誤維持既有的
終止行為。

已被兌換的房號回報 `ROOM_NOT_FOUND` 而非另設 `ROOM_FULL`：房號一旦兌換就從表中移除，
沒有「房間已滿」這個中間狀態，也順便不洩漏某個房號是否存在。

## 濫用防護

- `MaxPendingRooms`（預設 5000）限制同時存在的未兌換房號。
- `MaxJoinFailures`（預設 10）限制單一連線的猜號次數，超過即斷線。
- 房號空間 31^6 ≈ 8.9 億，配合上述限制，MVP 風險可接受。

## 已知限制

1. 仍是 host 權威，好友房不改變 host 可偽造結果的既有限制。
2. 房號只存在單一 instance 的記憶體。水平擴展需要共享儲存或 sticky routing；
   服務重啟會清掉所有未兌換的房號（與既有的「重啟會斷線」限制同級）。
3. 再戰讓每間房多存活最多 60 秒，記憶體成本由 rematch timer 與上述上限控制。
