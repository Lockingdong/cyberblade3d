# 2026-08-08 Mobile 零件工坊（第二段）

## 今天做了什麼

- `packages/core/src/parts/compatibility.ts` 新增 `resolveCustomConfig(type, stored)`：把儲存的（可能殘缺、可能是別顆陀螺留下的）配置補成完整且相容的 `CustomBeybladeConfig`。實作直接複用既有的 `validatePartCompatibility`——缺的欄位丟空字串進去，讓「沒選過」與「選了但現在不相容」走同一條 fallback。
- `apps/web/src/App.tsx` 原本那段 30 行的相容性 fallback 換成呼叫 `resolveCustomConfig`，行為不變。
- `packages/visuals/src/camera.ts` 新增 `PREVIEW_CAMERA_PRESETS` 與 `PREVIEW_CAMERA_PRESET_ORDER`：四個預覽鏡頭的座標、注視點、標籤與循環順序。Web 的 `CAMERA_PRESETS` 改成 spread 共用常數再補上自己的 SVG 圖示，`pos` 更名為 `position` 對齊既有的 `CameraView`。
- `apps/mobile/src/BladePreviewScene.tsx` 接上 `customSpec`（`BeybladePreviewWorld` 建構子本來就支援，只是 Mobile 沒傳）與 `preset`，鏡頭切換用跟 Web 相同的 lerp 補間。
- `apps/mobile/src/CustomizerIcons.tsx`（新）：用 `react-native-svg` 移植 Web 的 8 個圖示，路徑資料照抄。多加一個 `CameraPresetIcon`，依 preset 回傳對應圖示。
- `apps/mobile/src/PartCustomizer.tsx`（新，約 480 行）：Web 工坊的 RN 版。全螢幕 `Modal`、頂部 3D 舞台 + 鏡頭循環 + 分解圖切換、四個部位頁籤、零件卡片、數值差異面板、完成組裝。Web 的雙欄桌面版面在這裡攤成單欄捲動。
- `apps/mobile/src/profile.ts`（新）：AsyncStorage 版的 `loadCustomParts` / `saveCustomParts`，key 沿用 `cyberblade.customPartsMap`。
- `apps/mobile/App.tsx`：接上 `customPartsMap` / `currentConfig` / `customSpec`、主選單加「陀螺改裝工坊」入口、`BladePicker` 與預覽都改吃 `customSpec`，`prepareLocal` 補送四個零件 id（否則單機戰打的還是原廠配置）。
- `apps/mobile/package.json` 新增 `react-native-svg@15.15.4` 與 `@react-native-async-storage/async-storage@2.2.0`，版本取自 Expo 57 的 `bundledNativeModules.json`。
- 順帶修掉一個**既有的 Mobile 啟動 crash**：`react-native-worklets` / `react-native-reanimated` 從 `0.10.0` / `4.5.0` 對齊到 Expo Go 實際編進去的 `0.10.1` / `4.5.1`。詳見下面的除錯紀錄。

## 遇到的問題 / 解法

- 問題：`resolveCustomConfig` 放哪。原本規劃寫在 `assembly.ts`。
  - 解法：改放 `compatibility.ts`。它產出的是「config」不是「spec」，而且整個實作就是 `validatePartCompatibility` 的一層包裝，放隔壁最合理。兩者都由 `parts/index.ts` 匯出，呼叫端無感。
- 問題：Mobile 零件卡片上的 `重量 / 風格 / 穩定 / 轉速` 型別過不了。`"massContribution" in part` 對這個 union 只narrow 到 `{}`。
  - 解法：補上 Web 同樣的 `typeof` 判斷，`in` + `typeof` 才narrow 得到 `number`。
- 問題（比較實際的一個）：AsyncStorage 是非同步的，Web 的 localStorage 不是。玩家理論上可以在讀檔完成前就進工坊改零件，這時 `handleCustomConfigChange` 存下的 map 只有當前這顆陀螺，其他顆的存檔會被蓋掉。
  - 解法：讀檔改成 merge（`{ ...stored, ...current }`，玩家剛改的優先），寫檔改成獨立 effect 且在 `partsLoaded` 之前不動作。這樣「半空的 map 蓋掉存檔」這條路整個不存在。
- 問題：`pnpm exec prettier` 順手把 `compatibility.ts` 與 `parts.test.ts` 既有的程式碼全部重排，diff 從 27 行變成 111 行。
  - 解法：`git checkout` 這兩個檔再手動貼回新增的部分。不夾帶無關的排版變更。
## 除錯紀錄：Mobile 在模擬器上一啟動就 crash

驗收第二段時才發現 app 在 Expo Go 裡根本跑不起來。這條路上踩了四個獨立的坑，依序記下來。

### 1. Xcode 「installed but not selected」

iOS Simulator 整合工具拒絕 attach。一開始我以為是誤判，因為 `xcode-select -p` 就是回 `/Applications/Xcode.app/Contents/Developer`、`xcodebuild -version` 也正常。

實際查證：`/var/db/xcode_select_link` **不存在**。這個 symlink 才是 `xcode-select` 記錄選擇的地方，不存在代表從來沒明確選過，`xcode-select -p` 印的是它的 fallback 猜測。工具的訊息是對的。修復要 `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`，需要密碼所以留給人工執行。

### 2. 「Fetching Expo Go」不是卡住，是 53 KB/s

實測 npm registry 有 6.2 MB/s，GitHub release assets 只有 53 KB/s，差 117 倍。Expo Go 是 136 MB 的 GitHub release 檔，換算約 45 分鐘。CLI 用 spinner 顯示進度，輸出導向檔案時看不到位移，才誤判成卡死。

解法：從 `https://api.expo.dev/v2/versions/latest` 取 `sdkVersions['57.0.0'].iosClientUrl`，`curl` 抓完後 `tar -xzf` 包成 `Exponent.app` 再 `xcrun simctl install`。

### 3. 「Open in Expo Go?」確認框擋住 deep link

`simctl openurl` 會跳系統確認框，而環境沒有點擊注入能力（osascript 也沒有輔助使用權限）。

解法從 Expo CLI 原始碼（`@expo/cli/.../ios/simctl.ts` 的 `updateSimulatorLinkingPermissionsAsync`）挖到：預先寫入 scheme approval plist 就不會跳。

```
~/Library/Developer/CoreSimulator/Devices/<UDID>/data/Library/Preferences/com.apple.launchservices.schemeapproval.plist
key:   com.apple.CoreSimulator.CoreSimulatorBridge-->exp
value: host.exp.Exponent
```

### 4. 真正的 crash：worklets JSI 型別混淆

bundle 成功（1281 modules）但執行時 SIGSEGV，掛在 `worklets::JSIWorkletsModuleProxy::toOptimizedObject` → Hermes `cloneString`。

先確認責任歸屬：把第二段改動全部 `git stash` 後重測，crash 訊號、位址、frame **完全相同**，所以是 branch 上既有的問題，不是這次改出來的。

排除掉的假設：缺 `babel.config.js`（補了 config 與 `babel-preset-expo` 後 clear cache 重跑，crash 照舊，已收回）。

根因是從 Expo Go 二進位裡 `strings` 出來的：

| | 專案（修前） | Expo Go 57.0.6 |
|---|---|---|
| `react-native-worklets` | 0.10.0 | **0.10.1** |
| `react-native-reanimated` | 4.5.0 | **4.5.1** |

差一個 patch 本來不該炸。問題在 worklets 自己的版本守衛 `checkCppVersion.js` 的 `matchVersion`——註解白紙黑字寫 `compare only major and minor, skip patch`，所以 `0.10.0` vs `0.10.1` 被判定相符，那個本該丟出的可讀 "Mismatch between JavaScript part and native part of Worklets" 不會觸發。但 patch 之間 JSI 方法簽章實際上變了，型別對不上的呼叫就這樣穿過去。

crash 位址 `0x3ff0000000000008` 是關鍵證據：`0x3FF0000000000000` 正是 IEEE-754 的 double `1.0`，也就是一個 JS 數字被當成 String 指標拿去解，`cloneString` 一碰就死。

解法：把兩個套件對齊到 Expo Go 實際帶的版本。改完 crash 消失，app 正常啟動。

**留下的地雷**：`expo@57.0.7` 的 `bundledNativeModules.json` 還寫著舊的 4.5.0 / 0.10.0。之後跑 `npx expo install --check` 會想把版本降回去、把 crash 帶回來。比較耐久的做法是把 `expo` 升到 CLI 建議的 `~57.0.11` 讓它自己帶對版本，但那是獨立題目，這次沒做。

另外，這個不一致只影響 Expo Go；dev build 與 production build 的原生端是從 `node_modules` 編的，版本天然一致。

## 決策紀錄

- 決定：預覽鏡頭常數下沉到 `packages/visuals`，但圖示留在各自的 app。
  - 原因：座標是「同一顆陀螺該長什麼樣」的共用知識，圖示是平台的 render 細節（Web 是 `<svg>`，Mobile 是 `react-native-svg`）。硬要共用會讓 visuals 依賴 React。
  - 代價：兩邊各維護一份圖示，改圖要改兩處。
- 決定：Mobile 工坊用 `Modal` 而不是絕對定位的 overlay。
  - 原因：`ShareCardModal` 已經證明 expo-gl 的 `Canvas` 放在 `Modal` 裡可以動；而且 App 根節點是 column flex，用 overlay 得再處理堆疊與 flex 分配。
- 決定：Mobile 預覽鏡頭改用共用座標（從 `[0, 2.1, 3.8]` 看 `(0, 0.25, 0)` 變成 `[0, 2.8, 3.8]` 看 `(0, 0.38, 0)`）。
  - 原因：兩端框圖一致是這次下沉的目的。主選單的預覽構圖會微幅改變，這是刻意的。
- 決定：`prepareLocal` 補送零件 id。
  - 原因：不補的話工坊改了半天，單機戰打出來的還是原廠配置，這個功能等於只有觀賞用途。
- 決定：Mobile 的玩家名稱與戰績維持 session-only，這次只持久化零件配置。
  - 原因：第一段就講好的範圍，不順手擴散。

## 驗證

- `task check` 全綠：typecheck 9 個 workspace、`packages/core` 33 則測試（含新增的 4 則 `resolveCustomConfig`）、Go 測試照舊。
- `expo export --platform ios` 成功產出 5.4MB bundle（1151 modules）。這證明 `react-native-svg`、`@react-native-async-storage/async-storage` 與新的工坊程式碼在 Metro 下都解得到、編得過。
- Web 端回歸（瀏覽器實測，因為 `CAMERA_PRESETS` 與 `currentConfig` 都被改過）：
  - 鏡頭循環順序仍是 斜角 → 正頂 → 正側 → 正底 → 斜角，標籤讀的是共用常數。
  - 工坊開得起來，預設裝備的是 `resolveCustomConfig` 挑的第一顆相容零件（赤紅斬刃）。
  - 換成烈焰暴龍刃後數值差異即時更新（重量 1.14 kg `+0.04`、撞擊承受率 80% `+20`）。
  - reload 後配置仍在，代表 localStorage 經過新的共用函式仍能正確 round-trip。
- Mobile 在 iOS 18.5 模擬器（iPhone 16 Pro）+ Expo Go 57.0.6 上**能正常啟動**，標題畫面正確 render。這是修掉 worklets 版本不一致之後才成立的。
- **未能驗證：Mobile 的互動流程。** 環境沒有點擊注入能力——Simulator 整合工具因 xcode-select 問題無法 attach，`osascript` 也沒有輔助使用權限。Expo Go 首次啟動的開發者選單需要按一下 "Continue" 才能看到主選單，卡在這裡。（試過 `EXKernelDisableNuxDefaultsKey`，binary 裡有這個 key 但 Expo Go 57 顯然改用別的機制，沒生效。）所以「開工坊 → 換零件 → 看數值 → 重啟確認持久化」這串仍未跑過。

## 下一步

- 請在本機執行 `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`，之後 Simulator 工具就能 attach、可以注入點擊，補跑第二段的手動驗收：關掉 Expo Go 的開發者選單、開工坊、換四個部位、確認 3D 預覽即時反映與數值差異正確、**重啟 app 後配置仍在**。
- 第三段：Mobile 好友房選角。`OnlineSelection` 拆兩步、`powerActive` 只在力道步驟為 true、`readyOnline` 補送四個零件 id、更新 `apps/mobile/App.tsx` 建房畫面那句「自動開始」，並比照 Web 在離開選角階段時強制關閉工坊。

## 備註

- Web 的 `renderStatDiff` 一律把 `diff > 0` 標成綠色，包含「撞擊承受率」——多吃 20% 傷害顯示成綠色的加分項，語意是反的。Mobile 版刻意照抄這個行為以維持兩端一致，沒有偷改。要修的話應該兩端一起修。
- 兩端 `ready` 硬寫的 `stadium: "neon"` 仍是死欄位（第一段已記錄），這次沒動。

## 相關

- 主要責任層：`packages/core/src/parts/compatibility.ts`、`packages/visuals/src/camera.ts`、`apps/mobile/src/PartCustomizer.tsx`、`apps/mobile/App.tsx`。
- 前一篇：[2026-08-07 好友房進房後選陀螺（第一段：Go + Web）](2026-08-07-friend-room-blade-selection.md)。
