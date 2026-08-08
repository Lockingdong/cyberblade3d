# 2026-08-08 Mobile 視覺改版：對齊 Web 的印刷風

同一天的前一篇是[第三段：Mobile 好友房選角](2026-08-08-mobile-friend-room-selection.md)。這篇處理的是驗收時被指出的四件事：陀螺沒在轉、很慢、按鈕沒反應、手機版跟網頁版長得完全不一樣。

## 今天做了什麼

- `packages/design-system`：把原本那組深色 token（`#0b1020` 底、紫色 primary）換成 Web `apps/web/src/styles.css` 實際在用的那套印刷風語言——紙白底 `#f2f4f7`、墨線 `#1f2235`、青 `#009bd6`、紫 `#8e2dff`，加上 3px 邊框、零模糊的位移陰影、卡片傾斜角度、漸層與字級。
- `apps/mobile/src/ui.tsx`（新檔）：`PaperBackdrop`（格線＋兩顆光暈，用一張 SVG 畫）、`InkCard` / `InkPanel`（墨線邊框＋硬陰影＋可選傾斜）、`PrimaryButton`（`expo-linear-gradient`）、`InkButton`、`Eyebrow`、`LogoTitle`、`StatBar`。
- `apps/mobile/App.tsx` 與 `apps/mobile/src/PartCustomizer.tsx`：主選單、陀螺選擇、好友房選角、大廳、房號面板、結果頁、覆蓋層、零件工坊全部改用上面那組元件。對戰中的 HUD 與發射畫面維持深色，因為它們疊在 GL 場景上。
- `apps/mobile/metro.config.js`：把 `three` 的解析釘在單一目錄。

## 遇到的問題 / 解法

- 問題：「按鈕沒反應」。**這是我自己量錯座標**。我把模擬器截圖的高度當成 1879px，實際約 1998px（1206×2622 縮到 919 寬），差 6%，在畫面中段就偏掉約 35pt。陀螺卡片高 130pt 所以點得到，工坊按鈕只有 44pt 就落在外面。我一度把它講成「環境的點擊注入限制」，那是錯的。
  - 解法：換算比例改成 2.286，之後每一次點擊都命中。
- 問題：「陀螺沒在轉」。在 `useFrame` 裡放臨時 log 量出來是 60fps，`rotation.y` 每秒穩定增加 2.6 rad（正好是 `delta * 2.6`），浮動的 `position.y` 也在跑。相隔 30 秒的兩張截圖卻是像素完全相同。
  - 結論：`simctl io screenshot` 與預覽面板抓不到 expo-gl 的即時畫面，app 本身是正常的。要看動畫得直接看 Simulator 視窗。
- 問題：「很慢」。Expo Go 的 performance monitor 是 UI 60fps / JS 60fps / Layout 0.2ms，數字上不慢。但 RSS 960MB。
  - 拆解：Expo Go 空跑 293MB；載入我們的 bundle（無 GL canvas）687MB；再加一個預覽 canvas 960MB。也就是 JS bundle 約 394MB、GL 約 273MB。
  - 找到的真問題：three.js 一直在噴 `Multiple instances of Three.js being imported`。`apps/mobile/node_modules/three` 與 `packages/visuals/node_modules/three` 是兩個指向同一份實體套件的 symlink，Metro 以解析到的路徑當 key，所以把 three 打包並執行了兩次。
  - 解法：`metro.config.js` 用 `resolveRequest` 把 `three` 與 `three/*` 釘到 `fs.realpathSync` 出來的單一目錄。警告消失，RSS 從 **960MB 降到 797MB**（省約 163MB）。
- 問題：Mobile 連線上對戰會馬上「連線已中斷」。伺服器預設 `ALLOWED_ORIGINS` 只有 `http://localhost:5173,http://127.0.0.1:5173`；RN 的 WebSocket 會送出自己的 Origin，不在名單內就被 `CheckOrigin` 擋掉。Web 因為走 Vite 的 `/ws` proxy，Origin 是 5173 所以一直沒事。
  - 這次只在本機開發時把 ws 的 origin 加進 `ALLOWED_ORIGINS` 繞過，**沒有改程式**。詳見下面的下一步。
- 問題：RN 的 `Text` 只吃一組 `textShadow`，Web 的 logo 疊了五層。
  - 解法：`LogoTitle` 用兩個 `Text` 疊，後面那個是青色位移副本，前面那個用單層紙色描邊。再加 `adjustsFontSizeToFit` 讓標題固定一行。
- 問題：硬陰影不能用平台陰影做。`shadowRadius: 0` 在 iOS 勉強可以，但 Android 的 `elevation` 一定會糊，糊掉就變成「深度」而不是「墨線」。
  - 解法：陰影畫成一個實心的兄弟 View。位移寫在 skew 前面，這樣偏移量留在螢幕座標系，卡片傾斜時陰影不會被一起拉歪。

## 決策紀錄

- 決定：Mobile 改成跟 Web 一樣的淺色印刷風，而不是把 Web 改成深色。
  - 原因：Web 那套已經成形且完整（3423 行 CSS），Mobile 那套是拼湊的。往完成度高的那邊靠。
  - 代價：Mobile 從深色變淺色是一次很大的視覺翻轉。
- 決定：token 放 `packages/design-system`，Web 繼續讀自己的 CSS。
  - 原因：純 CSS 沒有 build step 就吃不到 TS module。與其為了共用而加一層 CSS 產生器，不如接受兩邊各有一份值、在檔案裡註明彼此是鏡像。
  - 放棄的選項：加 CSS 變數產生步驟——為了七、八個顏色不值得。

## 驗證

- `task check` 全綠。
- 模擬器實際跑過：主選單、零件工坊（開關三次）、線上大廳、建立好友房、Web 端加入後 Mobile 停在**選擇出戰陀螺**、按「確定出戰」進到力道計（62% 擺盪中）並出現「返回重選陀螺」。第三段的行為到此有畫面佐證。
- 記憶體：開關工坊三次 RSS 持平在 960→961MB，沒有洩漏；three 去重後降到 797MB。

## 下一步

- `ALLOWED_ORIGINS` 這件事要正式處理。目前的預設值讓 Mobile 在**正式環境**也會被擋，因為 RN 送的 Origin 不會是網頁的網域。要嘛把行動端的 Origin 加進允許清單，要嘛改成「沒有 Origin 或非瀏覽器來源就放行」，需要先決定安全性上要怎麼取捨。
- `apps/mobile/node_modules/@react-three/fiber 2` 是一個指向另一個 pnpm hash 的殘留 symlink（7/23 留下的），沒有被 import 到，但該清掉。
- 記憶體還有得看：JS bundle 佔 394MB 是 dev bundle 的量（未壓縮、含 source map），production build 應該小很多，但沒實測過。
- 對戰中的 HUD 與發射畫面仍是舊的深色配色，只是還沒不搭；等 Web 那邊確定戰鬥 UI 的樣子再一起對齊。

## 相關

- [第三段：Mobile 好友房選角](2026-08-08-mobile-friend-room-selection.md)
- [Mobile 零件工坊](2026-08-08-mobile-part-customizer.md)
