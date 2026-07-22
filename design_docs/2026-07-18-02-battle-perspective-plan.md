# Beyblade 戰鬥本地視角計畫

## 1. 問題與目標

目前 Host 與 Guest 雖然各自擁有 `localTopId`，但它只影響玩家 marker、HUD 與勝負文字；Web 與 Mobile 的 `BattleScene` 仍使用相同的 camera 方向與 midpoint tracking，因此雙方看到完全相同的戰鬥畫面。

目標是讓每位玩家都從自己的陀螺所在側觀看戰鬥：

- Host（p1）看到 p1 位於畫面前方／下方，p2 位於相反側。
- Guest（p2）看到 p2 位於畫面前方／下方，p1 位於相反側。
- 雙方仍共用相同的 p1/p2 世界座標、snapshot、物理結果與戰鬥事件。
- 不交換陀螺資料，不修改網路協定、HUD 或勝負判定。

## 2. 視角設計

### 2.1 本地玩家側

camera 的玩家側方向由 `localTopId` 決定，而不是由陀螺即時位置決定：

- p1 使用世界座標 x 軸負方向。
- p2 使用世界座標 x 軸正方向。

固定方向可避免兩顆陀螺在戰鬥中交會或越過彼此時，camera 突然翻轉 180 度。

### 2.2 戰鬥期間

- 以兩顆陀螺的 midpoint 作為 camera 注視目標。
- 從 local player 一側加入水平距離與高度偏移，使自己的陀螺自然位於前景／畫面下方。
- 保留目前的動態 framing、平滑移動與 collision camera shake。
- camera 的 view transform 只存在於本地 renderer，不改變 snapshot 內的物理座標。

### 2.3 Launch 期間

- orbit center 使用 local player 的初始位置。
- Host 與 Guest 的 orbit 方向和觀看側依 `localTopId` 對應。
- launch 結束後平順過渡至戰鬥期間的 local-player camera。

### 2.4 所有客戶端一致

Web 與 Mobile 必須使用同一套 local-side camera 計算規則，避免跨平台時 Host/Guest 的視角行為不同。共用邏輯應放在 visuals 套件或其他平台無關的共用模組，由兩套 `BattleScene` 呼叫。

## 3. 實作範圍

- 在共用 visuals 套件新增可測試的 local camera/view 計算邏輯。
- 更新 Web `BattleScene`，讓 launch、battle、ending、result 使用 `localTopId` 計算 camera。
- 更新 Mobile `BattleScene`，套用與 Web 相同的 camera 行為。
- 保留現有 `BeybladeVisualWorld` 的世界座標、marker、特效與 snapshot 套用流程。
- 不新增或修改 multiplayer wire message；既有 `matched.localTopId` 即為 camera 所需的身份來源。
- 單機模式繼續以 p1 作為 local player，維持目前 VS AI 的使用體驗。

## 4. 測試計畫

### 自動化測試

新增 camera/view helper 測試，涵蓋：

- p1 與 p2 的 camera 位置相對於戰場 midpoint 位於相反兩側。
- p1 與 p2 的視角互為對向，而非使用同一方向。
- local player 的即時位置變化不會改變固定視角方向。
- launch 與 battle 使用一致的 local-side 規則。
- camera 參數在缺少 snapshot 時仍可安全使用。

執行：

```sh
pnpm --filter @game-pool/beyblade-visuals test
pnpm --filter @game-pool/beyblade-web typecheck
pnpm --filter @game-pool/beyblade-mobile typecheck
pnpm --filter @game-pool/beyblade-web build
```

### 手動驗收

至少驗證以下組合：

- Web host ↔ Web guest。
- Web host ↔ Mobile guest。
- Mobile host ↔ Web guest。
- Mobile host ↔ Mobile guest。

驗收條件：

1. Host 畫面中的 p1 位於前方／下方，Guest 畫面中的 p2 位於前方／下方。
2. 兩端的戰鬥結果、陀螺相對位置、burst 與碰撞特效仍一致。
3. 兩顆陀螺交會或離開初始位置時，camera 不跳轉或翻面。
4. Guest 的 marker、HUD 與勝負文字仍正確指向 p2。
5. 單機 VS AI 仍維持 p1 玩家視角。
6. Web 與 Mobile 的 local-player framing 行為一致。

## 5. 非目標與限制

- 不建立兩套不同的物理模擬。
- 不將 snapshot 交換成 local/opponent 形態。
- 不以 camera 方向改寫 p1/p2 身份。
- 不修改 server matchmaking、state relay 或 result protocol。
- 不要求將畫面直接做成 2D 左右鏡像；目標是以 3D camera 從各自玩家側觀看共同戰場。
