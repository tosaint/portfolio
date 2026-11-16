# 中壢神社 古今對照：交接文件

給接手開發的人（包括新的 Claude 對話）。先讀完這份，再動程式。

- 作品頁：https://tosaint.com/portfolio/projects/zhongli-shrine/
- 3D 導覽：https://tosaint.com/portfolio/projects/zhongli-shrine/app/
- 穩定版分支：`shrine-tour-v1`（2026-11-16 的快照，不要在上面開發）。導覽壞掉時可以拿這個版本對照或還原。
- 海報、文宣上的 QR code 都指向作品頁，**這兩個網址不能改**。

## 作者的固定要求

1. **手機要順**。不加大檔案，新功能先想效能；夜間、燈籠都已調過，改動後要在手機上試。
2. **先文字討論，再動手**。作者常說「文字討論」：先列做法、讓作者選，不要直接改。
3. **出處寫法固定**：
   - 老照片：三森久子捐贈，壢中校史館藏
   - 1947 航照：中研院 GIS
   - 第一鳥居照片：藍清水校長提供：劉金鐘家族、吳慕舉校長相片
   - 配置考證：羅偉源
4. 學生姓名一律遮成「陳○安」這種寫法；公開的牆只放暱稱，Email 絕不公開。
5. 御守、繪馬、燈籠是「當代教育活動的參與創作，非宗教物件」，相關頁面都要有這句。
6. 介面文字用繁體中文，口吻給一般讀者看得懂，不交代重建技術細節。

## 檔案結構

```
zhongli-shrine/
  index.html            作品說明頁（封面線稿、六站介紹、#participate 參與區、繪馬牆預覽）
  participate/          說明頁內的三份表單（御守、繪馬、燈籠）＋繪馬牆對話框
    participate.js        表單送出到 Apps Script doPost；燈籠照片縮圖並保留 EXIF GPS
    questions.js          繪馬 10 題（不含答案，答案在 Ema.gs）
  omamori/index.html    御守手機桌布（網址 hash 帶資料，瀏覽器端用 canvas 畫）
  ema/                  繪馬正反面（ema.js 共用繪製）、wall.html 已改為轉址到說明頁
  gifts/                舊的「領取紀念」頁，已轉址到 ../#participate；img/ 是範例圖
  app/                  3D 導覽
    index.html            導覽頁面（main.js?v= 版本號每次改都要遞增）
    main.js               場景、六站 STOPS、夜間模式、心願燈籠、主迴圈
    shrine-proc.js        以程式建構的整座 1939 神社（公尺）：本殿、拜殿、神門、鳥居、燈籠…
    site.js               配置模型單位 ↔ 公尺 ↔ 經緯度（1 單位 ≈ 1.55 公尺）
    ground.js             地面底圖：今日航照、電子地圖、1921／1944 地形圖、1947 航照
    camsolve.js           老照片相機反求（DLT＋LM）
    map-data.json         地點卡片與校準點；history.json 年表
    lantern-config.js     燈籠 Apps Script 網址
    assets/               銅馬、狛犬掃描模型（glb）、照片研究
    photos/ slides/ oldmaps/   老照片、簡報截圖、舊地圖拼接
    3d.html align.html oldmap.html   研究用頁面（照片對位、古今地圖）
```

座標系：x = 平面 X，y = 高度，z = −(平面 Y)，單位公尺。神社內苑在原點附近，參道往 −x 延伸到第一鳥居（約 x = −194）。

## 3D 導覽的重點機制

- **六站導覽**：`STOPS`（main.js 開頭）。每站有 `eye`、`target`、`focus`（夜間主光打的位置與半徑）、`pins`、`thumbs`。網址 `#stop-3` 直接進第 3 站。
- **夜間模式**：`setNight` 以 0.45 秒漸變；夜間著色程式在閒置時先編好（`warmNight`），切換才不卡。導覽中，聚光燈依每站的 `focus` 照向主角，心願燈籠調暗。
- **自動解析度**：主迴圈依連續畫格的時間調整解析度。載入、編譯、日夜切換期間（`busy()`）的慢格不計，手機上限 1.75、下限 1.0。
- **心願燈籠**：資料來自燈籠 Apps Script（`?type=lantern`）。所有燈籠合為幾個 InstancedMesh，名字寫在同一張貼圖上。預設掛在外參道兩側的兩層燈籠架，勾「立柱」的改掛單盞立柱。
  - `#lantern-0012` 會飛到那一盞；點「心願燈籠」可以用暱稱或編號搜尋。
  - 測試時可加 `?lanapi=本機json網址` 換成假資料。

## Apps Script（三個獨立專案，各自整份貼上）

| 專案 | 用途 | 網頁應用程式 |
|---|---|---|
| Code.gs（御守） | 導覽心得 → 寄御守桌布 | doGet 人數、doPost 收表單 |
| Ema.gs（繪馬） | 10 題答對 6 題 → 寄繪馬、繪馬牆 | doGet 繪馬牆 JSON、doPost 收表單並計分 |
| Lantern.gs（燈籠） | 三處照片＋地磚尺寸 → 老師審核 → 點燈 | doGet 燈籠 JSON、doPost 收表單（送出即給編號與網址） |

- 每 5 分鐘排程處理：寄信、給編號、讀照片 GPS。
- 試算表「老師新增」分頁：填暱稱就點亮；「燈籠網址」欄可複製給本人。「隱藏」、「立柱」用勾選。
- **改了程式要重新部署**：部署 → 管理部署作業 → 鉛筆 → 版本：新版本 → 部署。
- **不要再執行 setupLantern**（會建立新的空表單、重設編號）。

## 部署流程（GitHub Pages）

```
git stash -- projects   # 若有未提交的改動
git checkout main && git pull
git checkout -b 新分支 && git stash pop
git add <只加改到的檔案>   # 不要加 _fonts/、測試用 json
git commit -m "..." && git push -u origin 新分支
gh api repos/tosaint/portfolio/pulls -f title=... -f head=新分支 -f base=main
gh api -X PUT repos/tosaint/portfolio/pulls/<編號>/merge
```

改 main.js、shrine-proc.js 時，記得遞增 `app/index.html`、`main.js` 裡的 `?v=` 版本號，手機才不會讀到快取。

本機測試：在 repo 根目錄 `python3 -m http.server 8765`，用 Playwright 開手機尺寸（390×844）截圖。three.js 由 jsdelivr 載入（0.180.0），測試時可導到本機 node_modules。

## 宣傳品（不在 repo 裡）

- 社群海報、簡報、A5 對折文宣：claude.ai 設計畫布「中壢神社 導覽紀念 宣傳海報」
- A5 文宣的可列印 PDF：A4 橫式雙面、短邊翻頁、黑白

## 接下來：校園空間遊戲

另開 `projects/clhs-game/`，**不要改動這個資料夾的網址與行為**。
- 可以直接 import 這裡的穩定模組（`shrine-proc.js`、`site.js`、`ground.js`）。需要修改時，複製一份到遊戲資料夾再改，避免改壞導覽。
- 遊戲動手前要先和作者討論：視角（第一／第三人稱、方塊風）、場景（1939 神社、今日校園、穿梭古今）、任務是否連結真實校園。
