# CyberBlade 3D：AI 架構導覽

這份文件是本遊戲目錄的修改索引。開始搜尋或修改前，先用下方的「需求 → 修改位置」縮小範圍；只有確認需求跨層時才擴大搜尋。

## 專案定位

CyberBlade 3D 是 Game Pool monorepo 中的獨立遊戲模組，包含 React Web、Expo / React Native Mobile、共用 TypeScript 遊戲套件，以及一個 Go WebSocket 配對服務。

遊戲目錄是 `games/beyblade/`；monorepo 根目錄位於 `../..`。共用的 workspace 套件（例如 `@game-pool/game-runtime`、設計系統與 TypeScript 設定）位於遊戲目錄之外，除非需求明確涉及平台共用能力，否則不要先搜尋或修改外部目錄。

## 先看這張依賴圖

```text
apps/web ─────┬──> packages/core <── packages/simulation
              ├──> packages/simulation
              ├──> packages/visuals ──> packages/core
              └──> packages/multiplayer ──> packages/core

apps/mobile ──┴──> 同一組 packages/*

apps/web、apps/mobile
        │
        └── WebSocket /ws
                 │
                 v
          services/api (Go)

services/api 不執行物理模擬，也不依賴資料庫。
TypeScript 與 Go 各自有一份線上協定定義，兩邊必須保持一致。
```

依賴方向應維持如下：

- `core` 是平台中立的領域模型與遊戲流程，不可依賴 React、Three.js、Cannon、瀏覽器或 React Native。
- `simulation` 實作 `core` 定義的模擬介面，只負責物理與戰鬥數值。
- `visuals` 消費快照與事件，只負責 Three.js 畫面，不可反過來決定勝負或物理狀態。
- `multiplayer` 消費 `core` 型別，封裝 WebSocket 協定、線上狀態機與 guest 端插值。
- `apps/*` 組裝上述套件，持有平台 UI、生命週期與 I/O。
- `services/api` 負責連線、FIFO 配對、房間狀態、協定驗證、限流與訊息轉送。

## 需求 → 優先修改位置

| 需求 | 先看／先改 | 常見連帶位置 |
| --- | --- | --- |
| 陀螺種類、名稱、能力值、剋制、顯示數值、組裝零件與限定規則 | `packages/core/src/parts/` 的 `blades.ts`/`ratchets.ts`/`bits.ts`/`chips.ts` 零件庫、`compatibility.ts` 限定與相容性驗證、`assembly.ts` 的 `assembleBeybladeSpec`、`packages/core/src/index.ts` 的 `BEYBLADES` | `packages/simulation/src/index.ts`、兩端 `App.tsx` 的 `descriptions`、協定驗證 |
| 戰鬥物理、AI 移動、撞擊傷害、轉速衰減、出界判定 | `packages/simulation/src/index.ts` | `packages/simulation/src/battle.test.ts`、`index.test.ts`；若勝負規則改變再看 `core` |
| 勝負條件、遊戲 phase、runtime 狀態轉換 | `packages/core/src/index.ts` 的 `resolveMatchFinish`、`BeybladeRuntime` | `packages/core/src/index.test.ts`、兩端 `App.tsx` |
| 陀螺 3D 模型、場館、特效、背景環境 | `packages/visuals/src/index.ts` | `packages/visuals/src/detailed/*`、`geometry-utils.ts`、相關 visuals tests |
| 高精度陀螺零件、3D 樣式拼裝與註冊 | `packages/visuals/src/detailed/` 的 `detailed/index.ts`（包含 `BLADE_BUILDERS`/`RATCHET_BUILDERS`/`BIT_BUILDERS`/`CHIP_BUILDERS`） | 全 10 種陀螺在 `detailed/` 擁有獨立 builder，並於 `index.ts` 進行零件註冊與導出 |
| 戰鬥／發射鏡頭 | `packages/visuals/src/camera.ts` | `apps/web/src/BattleScene.tsx`、`apps/mobile/src/BattleScene.tsx` |
| Web 頁面流程、選單、HUD、結果頁 | `apps/web/src/App.tsx` | `apps/web/src/styles.css`、對應元件與 `App.test.tsx` |
| Mobile 頁面流程、選單、HUD、結果頁 | `apps/mobile/App.tsx` | `apps/mobile/src/*`、`feedback.ts` |
| Web 音效／背景音樂 | `apps/web/src/audio.ts`、`apps/web/public/bgm.mp3` | `apps/web/src/App.tsx` |
| Mobile 震動回饋 | `apps/mobile/src/feedback.ts`、`feedback-deduper.ts` | `apps/mobile/App.tsx`、feedback tests |
| 玩家名稱、顏色、戰績保存 | Web：`apps/web/src/profile.ts`；共用資料規則：`packages/core/src/index.ts` | Web `App.tsx`；Mobile 目前只保存於當次 session |
| 分享卡資料內容 | `packages/core/src/share-card.ts` | Web：`ShareCardModal.tsx`、`share-card.ts`；Mobile：`src/ShareCard.tsx` |
| WebSocket URL 或平台連線差異 | Web：`apps/web/src/online.ts`；Mobile：`apps/mobile/src/online.ts` | `.env.example`、部署設定 |
| 配對 client、線上 phase、host／guest 協調 | `packages/multiplayer/src/matchmaking-client.ts`、`online-match-coordinator.ts` | 兩端 `App.tsx`、multiplayer tests |
| guest 畫面插值、外插、網路不穩判斷 | `packages/multiplayer/src/snapshot-timeline.ts` | `snapshot-timeline.test.ts` |
| WebSocket 訊息格式 | TS：`packages/multiplayer/src/protocol.ts`；Go：`services/api/internal/matchmaking/protocol.go` | 兩邊 protocol tests、client、hub；必要時同步升級兩邊 `PROTOCOL_VERSION` / `ProtocolVersion` |
| 配對順序、房間 phase、timeout、轉送與限流 | `services/api/internal/matchmaking/hub.go`、`room.go` | `hub_test.go`、`server_test.go` |
| HTTP 路由、Origin、WebSocket 升級 | `services/api/internal/matchmaking/server.go` | `services/api/cmd/api/main.go`、server tests |
| 開發／建置指令 | `Taskfile.yml`、各目錄 `package.json` | monorepo 根目錄 workspace 設定 |
| 未實作或規劃中的大功能 | `design_docs/` | 先確認文件描述是否已落地，不要把計畫當成現況 |

## 目錄與重要檔案

### `apps/web/`

- `src/main.tsx`：瀏覽器入口。
- `src/App.tsx`：Web 的應用組裝與主要 UI；同時協調 local／online 模式、runtime、配對、戰績與頁面 phase。這是大型 composition root，不應把可共用的規則繼續堆進來。
- `src/BattleScene.tsx`：React Three Fiber Canvas 與共用 `BeybladeVisualWorld` 的 Web adapter。
- `src/BladePreviewScene.tsx`：選角預覽。
- `src/styles.css`：主要 Web 視覺樣式。
- `src/audio.ts`：Web Audio 與 BGM。
- `src/profile.ts`：`localStorage` 玩家資料。
- `src/online.ts`：WebSocket URL 與離頁行為。
- `src/share-card.ts`、`src/ShareCardModal.tsx`：Web 分享卡繪製、分享與下載。

### `apps/mobile/`

- `App.tsx`：Expo 入口與 Mobile composition root；職責大致對應 Web `App.tsx`。
- `src/BattleScene.tsx`、`src/BladePreviewScene.tsx`：React Three Fiber Native adapter。
- `src/feedback.ts`、`src/feedback-deduper.ts`：觸覺回饋與遠端事件去重。
- `src/online.ts`：Mobile WebSocket 設定與 AppState 行為。
- `src/ShareCard.tsx`：原生截圖與分享。
- `metro.config.js`：monorepo / Expo bundling 設定。

Web 與 Mobile UI 是兩份實作。改平台 UI 時只改目標 app；改遊戲規則、資料型別、物理、3D world 或線上狀態機時，優先改共用 package，然後驗證兩個 app。若必須在兩端複製邏輯，先判斷它是否應下沉到 `packages/*`。

### `packages/core/`

- `src/index.ts`：陀螺與場館目錄、共用快照／事件／設定型別、勝負規則、戰績工具、環境場景目錄，以及 `BeybladeRuntime` 狀態機（部分零件 API 重新導出自 `parts/`）。
- `src/parts/`：陀螺零件資料庫（`blades.ts`, `ratchets.ts`, `bits.ts`, `chips.ts`）、特定陀螺限定與相容性驗證（`compatibility.ts`）、以及動態數值組裝（`assembly.ts`）。
- `src/share-card.ts`：平台中立的分享卡 view model 與尺寸常數。

這裡的型別是 simulation、visuals、multiplayer 與兩個 app 的共同契約。型別改動通常是跨層改動。

### `packages/simulation/`

- `src/index.ts`：`CannonBattleSimulation` 的完整實作，包括 fixed-step Cannon world、發射、AI steering、碰撞、傷害、spin decay、事件與快照。

物理模擬應保持 deterministic；新增隨機行為時使用 match seed 所建立的亂數來源，不要直接在 step 邏輯呼叫 `Math.random()`。

### `packages/visuals/`

- `src/index.ts`：`BeybladeVisualWorld`、`BeybladePreviewWorld`、場館、通用陀螺模型、戰鬥特效與五種環境背景。
- `src/camera.ts`：平台共用鏡頭計算。
- `src/detailed/`：全 10 種陀螺類型的高精度 4 件套模型 Builder (`<type>.ts`)、晶片圖騰 (`chip-art.ts`)，並於 `detailed/index.ts` 中以 `BLADE_BUILDERS`/`RATCHET_BUILDERS`/`BIT_BUILDERS`/`CHIP_BUILDERS` 完整註冊與導出。
- `src/geometry-utils.ts`：靜態 geometry 合併工具。

世界物件必須妥善重設與 dispose；Mobile 的 frame budget 也要納入考量。純模型或特效修改通常不需要進入兩端 Canvas adapter。

### `packages/multiplayer/`

- `src/protocol.ts`：TypeScript wire message、runtime decoder 與 protocol version。
- `src/matchmaking-client.ts`：低階 WebSocket transport，負責 handshake、序號與訊息序列化。
- `src/online-match-coordinator.ts`：平台中立的線上對戰狀態機。
- `src/snapshot-timeline.ts`：guest 端 snapshot buffer、插值／有限外插、事件釋放與 trail 衍生。
- `src/index.ts`：package exports。

### `services/api/`

- `cmd/api/main.go`：服務程序入口、環境變數、graceful shutdown。
- `internal/matchmaking/server.go`：`GET /health`、`GET /ws` 與 Origin 驗證。
- `internal/matchmaking/client.go`：每條 WebSocket 的 read/write pumps 與傳送佇列。
- `internal/matchmaking/hub.go`：單一 goroutine 擁有配對 queue、rooms 與狀態轉換。
- `internal/matchmaking/room.go`：房間資料與 timer。
- `internal/matchmaking/protocol.go`：Go wire schema、decode 與驗證。

不要為線上戰鬥狀態新增資料庫依賴，除非產品需求明確改變目前的無狀態 relay 架構。

## 關鍵執行流程

### 本機對戰

```text
App UI
  -> BeybladeRuntime.dispatch(prepare / launch / tick)
  -> CannonBattleSimulation
  -> BattleSnapshot + SimulationEvent
  -> BeybladeRuntime phase / result
  -> BattleScene
  -> BeybladeVisualWorld
```

`core` 判定流程與結果，`simulation` 產生物理快照，`visuals` 只呈現快照。

### 線上對戰

```text
兩端 MatchmakingClient
  -> Go Hub FIFO 配對
  -> host = p1，guest = p2
  -> 雙方 ready，server 選定 environment 並發送 start

host App
  -> 本機 BeybladeRuntime + CannonBattleSimulation
  -> 約每 50 ms 發 state，另發 collision / burst / ending / match_end
  -> Go service 驗證 host、phase、rate，再 relay 給 guest

guest App
  -> SnapshotTimeline buffer
  -> 插值 / 有限外插 + 遠端事件
  -> BattleScene
```

這不是 server-authoritative simulation。只有 host 執行戰鬥物理；Go server 是配對與受控 relay。任何可能造成 host／guest 顯示不一致的修改，都要同時檢查 coordinator、timeline、協定與兩端 App 的 host／guest 分支。

## 跨檔案一致性規則

1. 修改 wire message 時，同步修改：
   - `packages/multiplayer/src/protocol.ts`
   - `services/api/internal/matchmaking/protocol.go`
   - 對應 client / coordinator / hub 使用處
   - TypeScript 與 Go protocol tests
2. 新增陀螺類型時，至少檢查：
   - `BeybladeType`、對應零件與配置（`BLADE_PARTS`/`RATCHET_PARTS`/`BIT_PARTS`/`CHIP_PARTS`、`PRESET_ORDER`、`PRESET_CONFIGS`）及 `BEYBLADES`
   - simulation 是否支援其 `AiBehavior`／特殊能力
   - visuals 的專屬 detailed builder (`detailed/<type>.ts`)、`detailed/index.ts` 註冊與 `chip-art.ts` 圖騰
   - Web 與 Mobile 的 `descriptions`
   - TS 與 Go protocol 的 blade allowlist
3. 新增環境場景時，至少檢查：
   - `EnvironmentScene`、`ENVIRONMENT_SCENES`
   - visuals 的 environment builder／選擇邏輯
   - TS protocol validator
   - Go protocol validator 與 `pickRandomEnvironment`
4. `BattleSnapshot` 或 `SimulationEvent` 改動會影響 simulation、visuals、multiplayer wire conversion、timeline 與兩端場景。
5. 不要修改 `dist/`、`.turbo/`、`.expo/` 或 `node_modules/`；它們是生成物或依賴。
6. 工作樹可能已有使用者變更。先看 `git status --short`，不要覆蓋、格式化或回復不屬於當前任務的修改。

## 環境變數

以實際讀取程式碼為準：

- Go API：`GAME_API_ADDR`、`ALLOWED_ORIGINS`
- Web WebSocket：優先 `VITE_PUBLIC_WS_URL`，其次 `VITE_BEYBLADE_WS_URL`，未設定時使用同 host 的 `/ws`
- Mobile WebSocket：`EXPO_PUBLIC_BEYBLADE_WS_URL`，實機開發需使用可從裝置連到的位址

`.env.example` 可能包含整個 Game Pool 開發環境的其他變數；新增或改名時，要同步實際程式與範例檔。

## 驗證方式

從 `games/beyblade/` 執行最接近修改範圍的檢查：

```sh
# 單一 TypeScript package
pnpm -C packages/core typecheck
pnpm -C packages/core test

pnpm -C packages/simulation typecheck
pnpm -C packages/simulation test

pnpm -C packages/visuals typecheck
pnpm -C packages/visuals test

pnpm -C packages/multiplayer typecheck
pnpm -C packages/multiplayer test

# 平台 app
pnpm -C apps/web typecheck
pnpm -C apps/web test
pnpm -C apps/mobile typecheck
pnpm -C apps/mobile test

# Go service
go test ./services/api/...

# app + Go 的既定整合檢查
task check
```

`task check` 目前檢查兩個 app 與 Go service，不會取代四個共用 package 自己的 tests。共用型別或 package 行為有改動時，先跑該 package，再跑受影響 app 的 typecheck。3D 或 Expo 行為仍需在瀏覽器／實機驗證；自動測試無法完整覆蓋 WebGL、音效、觸覺回饋與原生分享。

## AI 修改時的最短流程

1. 先用本文件的表格定位責任層。
2. 只在該層與列出的連帶位置搜尋 symbol；不要一開始掃描整個 monorepo。
3. 閱讀鄰近 tests，確認既有行為與邊界條件。
4. 修改最小必要範圍，維持上述依賴方向。
5. 跑最接近的 test / typecheck；跨協定、共用型別或平台共用改動，再擴大驗證。
6. 若實作改變了責任邊界、入口、協定或常見修改位置，同步更新本文件。
