# CyberBlade 3D：即時陌生人配對線上對戰設計

## 目標

目前 CyberBlade 3D 是本機單機遊戲，Web 與 Mobile 都透過共用的
`@game-pool/beyblade-core`、`@game-pool/beyblade-simulation` 與
`@game-pool/beyblade-visuals` 執行同一套規則、物理與視覺。

本功能要在保留「單機 VS AI」模式的前提下，加入 Web 與 Expo/React Native
皆可使用的陌生人即時配對。

每局只有選擇陀螺、發射力道與發射角度需要同步；發射後雙方都不再操作。
因此 MVP 不需要 rollback、client prediction 或跨裝置 lockstep。

## 已確認的產品與技術決策

- 保留既有單機 VS AI 模式。
- 主選單新增「線上對戰」入口。
- 配對採 FIFO，一直等待直到配對成功或玩家取消，不做 AI fallback。
- 後端使用 Go WebSocket service，只負責配對、房間生命週期與訊息轉發，不執行 Cannon 物理模擬。
- 每場由伺服器指定：
  - `p1`：host，執行完整物理模擬並上傳狀態。
  - `p2`：guest，不執行物理，只播放 host 傳來的狀態。
- host 約以 20Hz 傳送 snapshot；guest 使用延遲播放與插值平滑畫面。
- MVP 不支援戰鬥中重連、rematch、排名或 server-authoritative 模擬。
- MVP 接受 host 可偽造狀態或結果的限制，只定位為無排名休閒對戰。
- 第一版以單一 matchmaking service instance 運行；水平擴展不在 MVP 範圍。

## 現有架構與責任邊界

```text
games/beyblade/
├── apps/
│   ├── web/                 React + Vite
│   └── mobile/              Expo + React Native
├── packages/
│   ├── core/                平台無關規則、runtime、snapshot/result types
│   ├── simulation/          Cannon 固定步長物理
│   ├── visuals/             共用 Three.js 場景與 snapshot 呈現
│   └── multiplayer/         新增：協定、連線狀態、snapshot timeline
├── services/
│   └── api/                 新增：Go matchmaking/WebSocket service
└── design_docs/
```

責任分配：

- `core` 不依賴 React、DOM、React Native、Three.js、WebSocket 或環境變數。
- `simulation` 只處理 host/單機的物理與戰鬥事件，不直接傳送網路訊息。
- `visuals` 接受 snapshot、event 與 `localTopId`，不判斷 host/guest。
- `multiplayer` 只依賴 `core`，提供 Web/Mobile 共用的協定與播放邏輯。
- Web/Mobile app 負責 UI、Socket 建立、公開環境變數、音效與裝置 feedback。
- Go service 擁有 matchmaking 與 room 狀態，不依賴遊戲前端實作。

`packages/multiplayer` 會同時被 Web 與 Mobile 使用，因此符合專案中「至少兩個
consumer 才建立共用 package」的原則。

## 整體架構

```text
Host（p1）                         Go service                     Guest（p2）
Web 或 Mobile                     單一 instance                  Web 或 Mobile

CannonBattleSimulation ──WS──► matchmaking queue ──WS──► SnapshotTimeline
BeybladeRuntime                   room state machine             插值後 BattleSnapshot
20Hz snapshot                     驗證、限流、relay              BeybladeVisualWorld
重要 battle events                                               HUD、音效、feedback
```

host 與 guest 都使用世界座標中的固定 `p1/p2`：

- `p1` 初始位置在 `x = -4`。
- `p2` 初始位置在 `x = 4`。
- 不因本機角色鏡像 snapshot 或交換網路資料。
- UI 與 marker 透過 `localTopId` 決定哪一顆是「你」。

## 1. 共用型別與現有 package 調整

### `packages/core`

現有型別使用 `playerType/aiType`、`playerPower/aiPower`，並在結果名稱中硬編碼
「玩家/AI」。線上模式加入後，底層戰鬥資料應改為角色中立：

```ts
interface MatchConfig {
  p1Type: BeybladeType;
  p2Type: BeybladeType;
  stadiumTheme: StadiumTheme;
  seed?: number;
  perfectLaunchTopIds?: readonly TopId[];
}

interface LaunchInput {
  p1Power: number;
  p1Angle: number;
  p2Power: number;
  p2Angle: number;
}

type TopId = "p1" | "p2";
```

- 單機模式設定 `perfectLaunchTopIds: ["p1"]`。
- 線上模式設定 `perfectLaunchTopIds: ["p1", "p2"]`，避免 guest 即使完美發射
  也沒有 15% RPM 加成。
- `MatchResult` 保留 `winnerId` 與物理 finish type；「玩家/AI/你/對手」由 app
  根據模式及 `localTopId` 格式化。
- 斷線不是物理賽果，不加入 `FinishType`；線上結果額外使用：

```ts
type MatchTermination = "completed" | "opponent_left" | "connection_lost";
```

這是一項有意識的 breaking refactor；Web、Mobile、simulation 與既有測試需在
同一個變更中更新，確保單機行為不變。

### `packages/simulation`

- 保留現有固定 60Hz step、seeded random 與 Cannon 模擬。
- 完美發射資格改由 `perfectLaunchTopIds` 決定，不再由 `isPlayer` boolean
  硬編碼 p1。
- simulation 仍只產生 `BattleSnapshot` 與 `SimulationEvent`。
- host 的網路傳送由 app/multiplayer coordinator 觀察 runtime state 後處理，
  simulation 不 import WebSocket client。

### `packages/visuals`

`BeybladeVisualWorld` 新增 `localTopId`：

```ts
new BeybladeVisualWorld(p1Type, p2Type, stadiumTheme, localTopId);
```

- 玩家 marker 跟隨 `localTopId`，不再固定跟隨 p1。
- snapshot 的物理 quaternion 仍不套到模型；球體 body 的滾動不代表陀螺模型
  應如何旋轉。
- 自轉、wobble、倒下與 burst 視覺仍由 snapshot 及 event 本地產生。
- guest 的 trail 根據插值後位置與速度本地產生，不經 WebSocket 逐筆 relay，
  避免既有 simulation 的高頻 `trail` events 增加協定複雜度。

單機模式仍可使用 simulation 原有的 trail events；visuals 必須避免同時收到
trail event 又啟用衍生 trail 而重複生成。

## 2. `packages/multiplayer`

建議檔案：

```text
packages/multiplayer/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── protocol.ts
    ├── matchmaking-client.ts
    ├── snapshot-timeline.ts
    └── online-match-coordinator.ts
```

### `protocol.ts`

- 使用 discriminated union 定義所有 client/server messages。
- 對外只輸出 JSON-safe 型別。
- 提供 runtime decoder/validator；不能因 TypeScript 型別存在就直接信任收到的 JSON。
- `protocolVersion` 在連線後第一個訊息送出；版本不符時伺服器立即回錯並關閉。
- `matchId` 視為 opaque string；所有房間訊息都帶 `matchId`，避免取消、離開、
  重新排隊時的舊訊息污染下一場。

### `matchmaking-client.ts`

不要直接依賴 DOM API；由 app 注入 Socket factory：

```ts
type SocketFactory = (url: string) => WebSocketLike;
```

提供：

- `connect(url)`
- `joinQueue()`
- `cancelQueue()`
- `ready(selection)`
- `leave()`
- `sendHostSnapshot(snapshot)`
- `sendHostEvent(event)`
- `subscribe(listener)`
- `dispose()`

Web 與 React Native 都有 WebSocket，但 URL、App lifecycle 與錯誤呈現不同，
因此 package 不直接讀取 `location`、`document`、`AppState` 或環境變數。

### `snapshot-timeline.ts`

Guest 專用、可獨立單元測試：

- 預設 interpolation delay：120ms。
- 依 `seq` 拒絕重複或舊 snapshot。
- 每包記錄本機 monotonic `receivedAt`，播放游標以 `now - 120ms` 選取前後資料，
  再使用 host 的 simulation `t` 對 snapshot/event 對齊；不能直接比較兩台裝置的
  wall clock。
- 在前後兩個 snapshot 間 lerp position、rpm 與 stability。
- boolean flags 使用 render time 前最新 snapshot 的值。
- 缺少後一包時，依最近兩包推導速度，最多外插 200ms。
- 單幀位移超過 3 單位或資料不足時直接 snap，避免 burst/出界被錯誤拉長。
- buffer 設定容量與時間上限，離開房間時完整清除。
- connection 尚未中斷但超過 500ms 沒有新 snapshot 時凍結最後畫面並顯示
  「連線不穩」，不可無限外插。

### `online-match-coordinator.ts`

維護不屬於單機 `BeybladeRuntime` 的線上流程：

```ts
type OnlinePhase =
  | "idle"
  | "connecting"
  | "queued"
  | "matched"
  | "waiting_ready"
  | "countdown"
  | "battle"
  | "ending"
  | "result"
  | "error";
```

- host 繼續使用 `BeybladeRuntime + CannonBattleSimulation`。
- coordinator 觀察 host runtime，每 50ms 傳最新 snapshot；舊 state 可被覆蓋，
  不建立無限佇列。
- guest 不建立或 step Cannon world；coordinator 從 `SnapshotTimeline` 產生
  `BattleScene`、HUD、音效所需的 snapshot/events/result view model。
- 單機與線上狀態分開，避免將 queue、WebSocket 或 room phase 塞入
  platform-neutral 的單機 runtime。

## 3. WebSocket 訊息協定

所有訊息皆為 JSON 且包含 `type`。數值必須是有限數字。

### Client → Server

```json
{"type":"hello","protocolVersion":1}
{"type":"join_queue","requestId":"q_opaque"}
{"type":"cancel_queue","requestId":"q_opaque"}
{"type":"ready","matchId":"m_opaque","blade":"attack","power":88.5,"angle":-23.4,"stadium":"neon"}
{"type":"leave","matchId":"m_opaque"}
```

只有 host 可送：

```json
{"type":"state","matchId":"m_opaque","seq":148,"t":7.42,
 "p1":{"p":[-1.23,0.8,2.01],"rpm":4123,"st":62.5,"f":0},
 "p2":{"p":[0.88,0.8,-1.4],"rpm":3852,"st":47.0,"f":0}}

{"type":"battle_event","matchId":"m_opaque","eventId":37,"stateSeq":148,"t":7.42,
 "event":{"kind":"collision","p":[-0.2,0.8,0.6],"intensity":3.2}}

{"type":"battle_event","matchId":"m_opaque","eventId":38,"stateSeq":149,"t":7.45,
 "event":{"kind":"burst","top":"p2","p":[0.1,0.8,0.4]}}

{"type":"battle_event","matchId":"m_opaque","eventId":39,"stateSeq":150,"t":7.47,
 "event":{"kind":"ending","winnerId":"p1","finishType":"BURST FINISH"}}

{"type":"match_end","matchId":"m_opaque","stateSeq":174,"t":7.77,
 "winnerId":"p1","finishType":"BURST FINISH","duration":7.47,"finalRpm":2850}
```

flags：

- bit 0：`isBurst`
- bit 1：`isStopped`
- bit 2：`isOut`

不傳 quaternion、type 或 stadium；這些不會在單場中改變，已包含在 `start`。
不 relay trail events，guest 從插值後位移本地生成。

### Server → Client

```json
{"type":"hello_ok","protocolVersion":1}
{"type":"queued","requestId":"q_opaque"}
{"type":"queue_left","requestId":"q_opaque"}
{"type":"matched","matchId":"m_opaque","role":"host","localTopId":"p1"}
{"type":"opponent_ready","matchId":"m_opaque"}
{"type":"start","matchId":"m_opaque","countdownMs":3000,"stadium":"neon",
 "p1":{"blade":"attack","power":88.5,"angle":-23.4},
 "p2":{"blade":"stamina","power":76.2,"angle":12.7}}
{"type":"opponent_left","matchId":"m_opaque","phase":"battle"}
{"type":"error","code":"ROOM_TIMEOUT","message":"配對房間已逾時"}
```

Server 只 relay host 的 `state`、`battle_event` 與 `match_end` 給 guest，且 relay
時保留 `seq/t`。Guest 將 event 與 terminal result 放入同一條延遲時間軸；
不得在插值畫面尚未抵達對應 `t` 時提前播放音效、burst 或切到結算畫面。

WebSocket 本身保證單連線內訊息順序；`seq` 仍用於去重、生命週期檢查與測試，
不是用來重新排序跨連線資料。State 使用獨立遞增的 `seq`，battle event 使用
獨立遞增的 `eventId`，並用 `stateSeq/t` 對齊狀態時間軸。

## 4. Go matchmaking service

位置：

```text
games/beyblade/services/api/
├── go.mod
├── cmd/api/main.go
└── internal/matchmaking/
    ├── protocol.go
    ├── client.go
    ├── hub.go
    ├── room.go
    └── *_test.go
```

使用 Go 1.24+、`net/http`、`log/slog` 與 `github.com/gorilla/websocket`。
新 module 加入 root `go.work`。

HTTP endpoints：

- `GET /health`
- `GET /ws`

環境變數：

- `GAME_API_ADDR`，預設 `:8787`。
- `ALLOWED_ORIGINS`，逗號分隔的 Web origin allowlist。

### Connection

- 每條連線一個 read pump、一個 write pump。
- 所有 outbound frame 只能由 write pump 寫入，避免 concurrent writes。
- ping interval 10 秒、pong/read deadline 30 秒。
- `SetReadLimit(4096)`。
- graceful shutdown：停止接收新連線、通知 hub 關閉房間、等待既有 goroutine
  結束，並設明確 shutdown timeout。
- Web browser 驗證 `Origin` 是否在 `ALLOWED_ORIGINS`。
- React Native 可能不帶 browser Origin；MVP 可允許空 Origin，但正式 WSS endpoint
  仍需只暴露必要路徑並做連線/訊息限流。

### Hub 與 queue

Hub 使用單一 goroutine 與 channels 序列化：

- FIFO 等待佇列。
- 同一 client 不可重複排隊或同時進入兩個 room。
- cancel、disconnect、match 成功都必須從 queue 清除。
- cancel 與 matched 競態以 hub 收到的順序為準，client 再用 `requestId/matchId`
  忽略過期回應。
- 前兩名組成 room，先進者為 host/p1，後進者為 guest/p2。

### Room state machine

```text
MATCHED
  └─ 收齊兩份合法 ready
      └─ COUNTDOWN
          └─ BATTLE
              ├─ 收到 ending event ─► ENDING ─► 收到一次 match_end ─► CLOSED
              └─ leave、disconnect 或 timeout ─────────────────────► CLOSED
```

- ready timeout：60 秒。
- countdown：3 秒。
- battle hard timeout：45 秒，涵蓋 20 秒比賽、ending、延遲與背景停頓。
- `ready` 對同一角色採 idempotent；內容變更則覆蓋到 countdown 開始前的最後值。
- host 的 stadium 為本場 stadium。
- ready validation：
  - blade/stadium 必須是已知 enum。
  - power 必須在 10–100。
  - angle 必須在 -30–30。
  - 所有數值必須有限。
- state 只在 BATTLE/ENDING 接受，且只接受目前 match 的 host。
- battle event 必須符合目前 phase；`ending` 最多接受一次，且會將 room 推進
  ENDING。
- host state 上限 40 msg/s；超限持續發生時關閉連線。
- 每個 room 只接受一次 `match_end`，之後忽略 state/event 並關閉 room。
- control messages 與 state 使用不同優先級：
  - 舊 state 在 send buffer 滿時可以丟棄或被新 state 覆蓋。
  - `start`、`opponent_left`、`error`、`match_end` 不可被 state 擠掉。
- 任一方離開或斷線時，另一方收到 `opponent_left`；server 可以確認 forfeit，
  但不替 host 驗證正常物理賽果。

### 單 instance 限制

Queue 與 room 都在記憶體內，因此 MVP 只能部署一個 instance。若未來要水平擴展，
必須選擇其中一種：

- load balancer sticky routing 加集中式 queue/room ownership；或
- Redis/NATS 等共享 matchmaking 與 pub/sub。

在完成共享 coordinator 前不可直接把 replica 數量調高。

## 5. Web 與 Mobile UI 流程

Web 與 Mobile 使用相同 coordinator，只有 UI component 與 lifecycle adapter
分開實作。

### 主流程

1. 點「線上對戰」。
2. 建立 WebSocket，完成 protocol hello 後送 `join_queue`。
3. 顯示配對 overlay，可取消。
4. 收到 `matched` 後選擇陀螺與發射。
5. p2 的 stadium UI 顯示「由對方選擇」並停用。
6. 玩家觸發發射時凍結 power、產生 angle、送 `ready`。
7. 收到 `start` 後，以 `countdownMs` 顯示本地倒數。
8. host 建立並 launch 本地 simulation；guest 啟動 snapshot playback。
9. Battle HUD 左側固定顯示 `localTopId`，名稱使用「你／對手」。
10. 正常結束時，guest 播放到 `match_end.t` 後才顯示勝敗。
11. 線上結果頁不顯示「再戰一局」；返回主選單後重新排隊。

### 離開與斷線

- 排隊中取消：回主選單。
- matched/ready/countdown 階段對手離開：顯示提示並回主選單。
- battle 階段對手明確 leave/close：本機結果為 `opponent_left`。
- 本機連線遺失：顯示 `connection_lost`，不自行宣告勝利。
- host 連線遺失時立即停止 simulation。
- App 進背景：
  - host 顯示警告並主動 leave，避免 guest 長時間停在凍結畫面。
  - guest 可短暫保留畫面，但不做 MVP 重連。

正常關閉分頁/App 通常能快速通知對手；silent network loss 最差判定時間由
30 秒 read deadline 決定，驗收不可一律要求「數秒內」完成。

### URL 設定

Web：

```text
VITE_BEYBLADE_WS_URL=wss://example.com/ws
```

- 未設定時，local development 可依 `location.host` 推導 `/ws`。
- `apps/web/vite.config.ts` 增加 `/ws` WebSocket proxy 到 `ws://localhost:8787`。

Mobile：

```text
EXPO_PUBLIC_BEYBLADE_WS_URL=wss://example.com/ws
```

- 不可使用 `location.host`。
- 實機 local development 使用開發電腦 LAN IP，不使用 `localhost`。

Production 一律使用 `wss://`。

## 6. 檔案異動

| 路徑                                               | 動作                                                |
| -------------------------------------------------- | --------------------------------------------------- |
| `games/beyblade/services/api/**`                   | 新增 matchmaking/WebSocket service 與測試           |
| `games/beyblade/packages/multiplayer/**`           | 新增 protocol、client、coordinator、timeline 與測試 |
| `games/beyblade/packages/core/src/index.ts`        | 將 player/AI 型別改為 p1/p2，補 termination 型別    |
| `games/beyblade/packages/core/src/index.test.ts`   | 更新單機規則與結果測試                              |
| `games/beyblade/packages/simulation/src/index.ts`  | 支援每個 top 的完美發射資格                         |
| `games/beyblade/packages/simulation/src/*.test.ts` | 新增雙玩家公平性與回歸測試                          |
| `games/beyblade/packages/visuals/src/index.ts`     | 支援 `localTopId` 與 guest 衍生 trail               |
| `games/beyblade/apps/web/src/App.tsx`              | 線上入口、overlays、角色映射、結算                  |
| `games/beyblade/apps/web/src/BattleScene.tsx`      | 傳入 `localTopId` 與遠端 snapshot                   |
| `games/beyblade/apps/web/src/styles.css`           | 線上 UI 樣式                                        |
| `games/beyblade/apps/web/vite.config.ts`           | `/ws` development proxy                             |
| `games/beyblade/apps/mobile/App.tsx`               | 線上入口、AppState 與 overlays                      |
| `games/beyblade/apps/mobile/src/BattleScene.tsx`   | 傳入 `localTopId` 與遠端 snapshot                   |
| `games/beyblade/apps/mobile/src/feedback.ts`       | 遠端 event feedback 去重                            |
| `go.work`、`go.work.sum`                           | 加入 Beyblade Go module                             |
| `Taskfile.yml`                                     | 確認 `GAME=beyblade` dev/check/build 可用           |
| `infra/compose.yaml`                               | 新增單 instance Beyblade service                    |
| `infra/docker/go-service.Dockerfile`               | 讓 image build 可包含 Beyblade service              |
| `.env.example`、README                             | 補 Web/Mobile URL、port 與啟動方式                  |

Web production image 與 reverse proxy 若仍使用目前針對 tic-tac-toe 的固定
Dockerfile，也必須一併參數化或新增 Beyblade deploy target。

## 7. 分階段實作計畫

各 Phase 依序進行。前一階段的完成條件通過後才進入下一階段，避免同時修改
simulation、網路、兩套 UI 與部署設定而難以定位問題。

### Phase 1：戰鬥模型角色中立化

目標：先移除底層對 `player/AI` 的硬編碼，建立線上模式可安全共用的 p1/p2
模型；本階段不加入任何網路行為。

實作：

- [x] 在 `packages/core` 新增 `TopId`。
- [x] 將 `MatchConfig.playerType/aiType` 改為 `p1Type/p2Type`。
- [x] 將 `LaunchInput.player*/ai*` 改為 `p1*/p2*`。
- [x] 將完美發射資格改為 `perfectLaunchTopIds`。
- [x] 移除 core result 對「玩家/AI」的硬編碼，交由 app 格式化。
- [x] 更新 Web、Mobile、simulation 與既有測試的呼叫端。
- [x] 為 `BeybladeVisualWorld` 與兩套 `BattleScene` 加入 `localTopId`。
- [x] marker、HUD 與 result 依 `localTopId` 顯示「你／對手」或「玩家／AI」。
- [x] 保持單機預設為 `p1 = 玩家`、`p2 = AI`。

驗證：

```sh
pnpm --filter './games/beyblade/**' typecheck
pnpm --filter './games/beyblade/**' test
pnpm --filter @game-pool/beyblade-web build
pnpm --filter @game-pool/beyblade-mobile build
```

完成條件：

- Web/Mobile 單機 VS AI 行為與改動前一致。
- p1 與 p2 的完美發射資格都有單元測試。
- 將 `localTopId` 設為 p2 時，marker、HUD 與勝負映射正確。

### Phase 2：多人協定與 Guest 播放核心

目標：完成不依賴實際伺服器的 TypeScript 多人基礎，先用測試資料證明 guest
可以平滑播放 host snapshot。

實作：

- [x] 建立 `@game-pool/beyblade-multiplayer` package。
- [x] 定義完整 client/server protocol discriminated unions。
- [x] 實作所有 inbound JSON 的 runtime decoder/validator。
- [x] 定義 `WebSocketLike`、`SocketFactory` 與連線事件介面。
- [x] 實作 `SnapshotTimeline` 的 buffer、120ms interpolation 與 200ms
      extrapolation。
- [x] 實作 seq 去重、teleport snap、500ms stale freeze 與 buffer reset。
- [x] 將 collision、burst、ending、match_end 排入同一播放時間軸。
- [x] 實作 guest 衍生 trail，並避免單機 trail event 重複生成。
- [x] 建立 `OnlineMatchCoordinator` 的 phase/state/view model，但先以 fake transport
      驗證。

驗證：

```sh
pnpm --filter @game-pool/beyblade-multiplayer typecheck
pnpm --filter @game-pool/beyblade-multiplayer test
```

完成條件：

- 使用錄製或人工建立的 snapshot sequence，可以在無 Cannon world 的情況下播放。
- jitter、缺包、舊 seq、teleport、matchId 切換都有單元測試。
- event 與結算不會早於對應的插值畫面。

### Phase 3：Go Matchmaking Service

目標：完成單 instance 的配對、房間狀態機與 relay；本階段先用 Go integration
test/CLI client 驗證，不接 UI。

實作：

- [x] 建立 `games/beyblade/services/api` Go module 並加入 `go.work`。
- [x] 建立 `GET /health` 與 `GET /ws`。
- [x] 實作 read pump、write pump、ping/pong、read limit 與 graceful shutdown。
- [x] 實作 protocol hello/version validation。
- [x] 實作單 goroutine Hub、FIFO queue、cancel 與 disconnect cleanup。
- [x] 實作 MATCHED → COUNTDOWN → BATTLE → ENDING → CLOSED room state machine。
- [x] 驗證 ready enum、power、angle、finite number、matchId 與目前 phase。
- [x] 限制 state/event 只能由 host 傳送。
- [x] 實作 state 40 msg/s rate limit。
- [x] 分離可丟棄 state 與不可丟棄 control message queue。
- [x] 實作 ready timeout、battle timeout、opponent_left 與 match_end idempotency。

驗證：

```sh
go test ./games/beyblade/services/api/...
go test -race ./games/beyblade/services/api/...
```

完成條件：

- 兩個 integration test client 可排隊、配對、ready、start 及結束房間。
- cancel/matched race、slow guest、斷線與 timeout 不會留下 queue/room。
- race detector 通過，測試結束後沒有持續運行的 room/client goroutine。

### Phase 4：Web 線上對戰 Vertical Slice

目標：先完成兩個 Web client 從配對到正常結算的最小完整流程，暫不要求所有
特效、Mobile 與 production deployment。

實作：

- [x] 在 `apps/web/vite.config.ts` 加入 `/ws` development proxy。
- [x] 加入 `VITE_BEYBLADE_WS_URL` 解析與 Socket factory。
- [x] 主選單加入單機／線上模式入口。
- [x] 完成 connecting、queued、matched、waiting_ready、countdown overlays。
- [x] 完成取消配對、選擇陀螺、host stadium、雙方 ready。
- [x] host 使用既有 runtime/simulation 啟動戰鬥。
- [x] host 每 50ms 傳最新 snapshot，ENDING 期間繼續傳送。
- [x] guest 使用 `SnapshotTimeline`，不建立 Cannon simulation。
- [x] HUD、timer、marker 與 result 依 `localTopId` 映射。
- [x] 線上結算隱藏 rematch，只提供返回主選單。

驗證：

```sh
go run ./games/beyblade/services/api/cmd/api
pnpm --filter @game-pool/beyblade-web dev
```

完成條件：

- 兩個瀏覽器可完成 queue → ready → countdown → battle → result。
- p1/p2 可選不同陀螺，兩端 snapshot、timer、winner 與 finish type 一致。
- guest 端不執行 `CannonBattleSimulation.step()`。
- 單機入口仍能正常完成一場戰鬥。

### Phase 5：事件、異常與網路韌性

目標：補齊 Vertical Slice 中刻意延後的特效、ending、離開與不穩定網路處理。

實作：

- [x] Relay collision、burst、ending 與 match_end。
- [x] Guest 音效、火花、burst、camera shake 與慢動作依 timeline 播放。
- [x] 完成 `opponent_left`、`connection_lost` 與 `MatchTermination` UI。
- [x] host 離房或斷線時立即停止 simulation/state sender。
- [x] guest 超過 500ms 未收到 state 時凍結並顯示「連線不穩」。
- [x] Web page hide/close 時依目前 phase 送出 leave。
- [x] 以人工 delay、jitter、drop 與 bandwidth throttling 測試 interpolation。
- [x] 確認 state backpressure 時只丟舊 snapshot，不丟 control message。

完成條件：

- BURST、OVER、SPIN、TIME 四種結局在兩端一致。
- collision/burst/ending/result 不會比畫面早播放。
- 正常離開、關分頁與 silent network loss 都能結束房間。
- send buffer 與 snapshot timeline 不會持續成長。

### Phase 6：Mobile 整合與跨平台驗收

目標：將已在 Web 驗證的 coordinator 接到 Expo client，完成 Web/Mobile
交叉配對。

實作：

- [x] 加入 `EXPO_PUBLIC_BEYBLADE_WS_URL` 與 React Native Socket factory。
- [x] 在 Mobile App 加入與 Web 等價的線上 phase UI。
- [x] 將 Mobile `BattleScene`、HUD、feedback 接到遠端 view model。
- [x] 使用 `AppState` 處理 host/guest 進背景；host 進背景主動 leave。
- [x] 確認 feedback event 依 eventId 去重，不因 React render 重播。
- [ ] 驗證 LAN development URL、production WSS 與實體裝置網路切換。

驗證矩陣：

- [ ] Web host ↔ Mobile guest。
- [ ] Mobile host ↔ Web guest。
- [ ] Mobile host ↔ Mobile guest。
- [ ] iOS 實體裝置。
- [ ] Android 實體裝置。

完成條件：

- 四種 client 組合的角色、畫面、事件與結果一致。
- App 進背景、切換 Wi-Fi/行動網路時不會讓 room 永久卡住。
- Mobile 單機 VS AI 回歸通過。

### Phase 7：部署、文件與 Release Gate

目標：將已完成的功能接入 repository 的開發、建置與 production deployment
流程。

實作：

- [ ] 更新 `Taskfile.yml`，讓 `task dev/check/build GAME=beyblade` 可用。
- [ ] 更新 `infra/compose.yaml`，加入單 instance Beyblade service。
- [ ] 調整 Go/Web Dockerfile，移除只支援 tic-tac-toe 的固定路徑。
- [ ] 設定 production `/ws` reverse proxy、WebSocket upgrade 與 TLS。
- [ ] 補上 `GAME_API_ADDR`、`ALLOWED_ORIGINS`、Web/Mobile WS URL。
- [ ] 更新 `.env.example`、root README 與 Beyblade README。
- [ ] 加入 queue wait、active room、disconnect reason、state drop count 等 log/metric。
- [ ] 執行完整自動化、雙裝置測試與單機回歸。
- [ ] 記錄單 instance、無重連、host-authoritative/可作弊等 release limitation。

Release Gate：

- [ ] Section 8 的所有自動化檢查通過。
- [ ] Section 9 的手動驗收全部完成。
- [ ] Production 只使用 `wss://`。
- [ ] 部署 replica 固定為 1。
- [ ] 沒有把此模式用於排名、獎勵或可信賽果。

## 8. 自動化驗證

### TypeScript

```sh
pnpm --filter './games/beyblade/**' typecheck
pnpm --filter './games/beyblade/**' test
pnpm --filter './games/beyblade/**' build
```

新增測試：

- Snapshot interpolation、最多 200ms extrapolation、teleport snap。
- duplicate/old seq、buffer reset、matchId 切換。
- collision/burst/ending/match_end 依 timeline 時間播放。
- p1/p2 都能取得完美發射加成。
- guest localTopId 的 HUD、marker、winner mapping。
- 單機 VS AI 完整回歸。

### Go

```sh
go test ./games/beyblade/services/api/...
go test -race ./games/beyblade/services/api/...
```

新增測試：

- FIFO matchmaking、cancel/matched race、disconnect queue cleanup。
- duplicate ready、invalid ready、ready timeout。
- 非 host 送 state/event 被拒絕。
- state rate limit 與 read limit。
- slow guest 時丟 state 但保留 control message。
- match_end idempotency、room timeout、雙方 disconnect。
- graceful shutdown 無 goroutine leak。

## 9. 手動驗收

至少涵蓋以下組合：

- Web host ↔ Web guest。
- Web host ↔ Mobile guest。
- Mobile host ↔ Web guest。
- Mobile host ↔ Mobile guest。

驗收項目：

1. 兩個 client 可配對、取消、離開後重新排隊。
2. p1/p2 選不同陀螺，雙方看到相同世界位置與戰鬥結果。
3. guest 的陀螺 marker、HUD 左側與勝負都正確指向自己。
4. 兩邊完美發射加成都生效。
5. guest 畫面在一般網路與人工 jitter/loss 下仍平滑。
6. collision、burst、慢動作、結果不早於插值畫面。
7. BURST、OVER、SPIN、TIME 四種正常結局一致。
8. battle 中 host/guest 分別離開時，對方收到正確 termination。
9. silent network loss 在 heartbeat deadline 後結束，不永久卡住。
10. host App 進背景會離房，不讓 guest 長時間凍結。
11. 單機 VS AI 的 Web/Mobile 操作、結果、音效與特效不受影響。
12. DevTools 或 service metrics 顯示 snapshot 約 20Hz，send queue 不持續成長。

Expo、Three.js 與 App lifecycle 行為必須在實體 iOS/Android 裝置驗證；只有
typecheck、Vitest 或 Expo export 不足以宣告 Mobile 線上對戰完成。

## 10. MVP 限制與後續方向

- Host authoritative 可作弊，不能用於排名或獎勵。
- 單 instance 是明確部署限制。
- 不支援戰鬥中重連；短暫切網路也可能判定該場結束。
- 不支援 rematch、好友房、觀戰、配對分區或技術評分。
- 玩家量增加後應加入 queue wait metrics、active rooms、disconnect reason、
  state drop count 與 message rate 等 observability。
- 若未來加入戰鬥中操作、排名或獎勵，需重新評估 server-authoritative
  simulation、input validation、authentication 與防作弊，不能沿用此 MVP
  的信任模型。
