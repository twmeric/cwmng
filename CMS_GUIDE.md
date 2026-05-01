# CWMNG CMS 內容管理指南

本文檔說明如何透過 Admin 後台管理網站內容，以及修改內容時的標準作業流程（SOP）。

---

## 1. Admin 後台入口

- **網址**: `https://cwmng.jkdcoding.com/admin.html`
- **密碼**: `Maid360`

登入後可以看到以下功能模組：

| 模組 | 用途 |
|------|------|
| **儀表板** | 快速概覽：方案數量、查詢數量、快速操作 |
| **內容管理** | 分段式表單編輯 CMS 內容 |
| **媒體庫** | 管理圖片/影片 URL，複製連結到表單 |
| **客戶查詢** | 查看、篩選、編輯客戶留痕記錄 |
| **網站分析** | 最近 7 日的 PageView / Interaction / Sessions |
| **一鍵部署** | 手動觸發 GitHub Actions 重新部署 |

---

## 2. 內容管理（CMS）各 Tab 說明

進入「內容管理」後，上方有一排 tab，對應網站的各個區塊：

| Tab | 對應網站區塊 | 可修改內容 |
|-----|-------------|-----------|
| **網站資訊** | 全站 Meta / SEO | 網站標題、描述、WhatsApp 號碼、電郵、預設訊息 |
| **導航列** | Navbar | 選單項目、CTA 按鈕文字 |
| **首頁 Hero** | Hero Section | 主標題、副標題、CTA 按鈕、統計數字、信任徽章 |
| **快捷入口** | Quick Links | WhatsApp 索取清單、直接查詢等卡片 |
| **三大痛點** | Problems | 三張問題卡片的標題、描述、圖片、解決方案 |
| **服務方案** | Solutions | 三種方案的內容、價格、賣點、CTA |
| **開通流程** | Process | 三步驟的標題與描述、流程圖片 |
| **定價比較** | Pricing | 對比表格、計算機文案、CTA |
| **清單推廣** | Download CTA | 申請文件清單區塊的圖文 |
| **信任背書** | Trust | 四大徽章、四個統計數字 |
| **客戶見證** | Testimonials | 輪播評價卡片 |
| **常見問題** | FAQ | 摺疊式問答，可附加 CTA 連結 |
| **CTA 區域** | CTA Section | 底部大行動呼籲區塊 |
| **跑馬燈** | Marquee | 支付方式無限滾動條 |
| **Sticky CTA** | 底部浮動條 | 滑動後出現的固定 CTA |
| **彈窗 Modal** | Modal 內容 | 諮詢表單與清單表單的文案 |
| **頁尾 Footer** | Footer | 品牌描述、三欄連結、聯絡方式、版權 |
| **原始 JSON** | 全部 | 進階用戶可直接編輯完整 JSON |

---

## 3. 修改內容的黃金法則

### 3.1 什麼是「四點同步原則」？

這個網站是 **CMS 驅動** 的，前端內容會被 JavaScript 動態覆蓋。因此，修改任何 CMS 欄位時，必須確保以下四點一致：

```
1. Worker 預設值      → cms-worker/src/index.js → getDefaultCMSData()
2. Admin 後台表單     → admin.html → renderXxxForm()
3. HTML fallback     → index.html 的靜態文字
4. JS render 邏輯     → script.js → renderXxx()
```

> **為什麼重要？** 如果四點不同步，會出現「內容閃一下又變回舊的」這種詭異現象。

### 3.2 修改順序（Admin Form First）

**絕對正確的順序**：

1. **先改 Admin 表單**（讓用戶能看得見、編輯得到）
2. **再改 Worker 預設值**（確保新欄位有初始內容）
3. **再改 JS render 邏輯**（如有必要）
4. **最後改 HTML fallback**（SEO / No-JS 備援）

---

## 4. 常見修改場景 SOP

### 4.1 改一句文案（如 Hero 標題）

**適用**：不改欄位結構，只改現有文字內容。

**步驟**：
1. 登入 Admin → 內容管理 → 對應 tab
2. 修改欄位，點擊「儲存變更」
3. ✅ 完成。無需 Push。

> 可選：同步更新 `cms-worker/src/index.js` 的 `getDefaultCMSData()`，讓新部署的網站也有正確預設值。

### 4.2 改一個價格（如 Solutions 方案價格）

**步驟**：
1. Admin → 內容管理 → 服務方案
2. 找到對應方案，修改「價格數字」和「價格單位」
3. 點擊「儲存變更」
4. ✅ 完成。

### 4.3 換一張圖片

**步驟**：
1. 將新圖片放入 `images/` 或 `images/textless/` 資料夾
2. **如果是透明 PNG，必須同時生成 `-stroke.png` 版本**
3. Push 到 GitHub（讓圖片上傳到 CDN）
4. Admin → 內容管理 → 對應 tab，修改圖片 URL
5. 同步更新 `cms-worker/src/index.js` 和 `index.html` 中的圖片路徑
6. 點擊「儲存變更」
7. 必要時觸發「一鍵部署」

### 4.4 新增一個 FAQ 項目

**步驟**：
1. Admin → 內容管理 → 常見問題
2. 直接在最後一個問題下方輸入框填寫新內容
3. 點擊「儲存變更」
4. 同步更新 `cms-worker/src/index.js` 的 `faq.items`
5. 同步更新 `index.html` 中的靜態 FAQ HTML

> 注意：FAQ 的 JSON Schema（`faqSchema`）也會被 `renderFAQ()` 動態更新，所以 `index.html` 的 fallback 主要為了 No-JS 場景。

### 4.5 新增一個 CMS 欄位（結構性變更）

**這是最複雜的場景，必須嚴格遵守 Admin Form First！**

**步驟**：
1. **Admin 表單**：在 `admin.html` 的對應 `renderXxxForm()` 函數中新增 `inputRow()`
2. **Worker 預設值**：在 `cms-worker/src/index.js` 的 `getDefaultCMSData()` 中加入新欄位和預設值
3. **JS Render**：在 `script.js` 的對應 `renderXxx()` 函數中加入覆蓋邏輯
4. **HTML Fallback**：在 `index.html` 中加入對應的靜態內容
5. Push 所有變更到 GitHub
6. 觸發部署
7. 用無痕視窗測試，觀察 5 秒確認沒有閃爍

---

## 5. 媒體庫使用說明

「媒體庫」不是真正的雲端硬碟，而是一個 **URL 登記簿**。

### 5.1 新增媒體

1. 先把圖片透過 Git Push 到 `images/` 資料夾
2. Admin → 媒體庫
3. 填寫名稱、路徑（如 `images/logo.png`）、類型、Alt 文字
4. 點擊「新增媒體」→「儲存變更」

### 5.2 複製 URL 到表單

在媒體庫卡片上點擊「複製 URL」，然後到「內容管理」的圖片欄位貼上即可。

### 5.3 自動掃描

媒體庫下方會自動顯示「目前 CMS 正在使用的媒體」，方便檢查是否有遺漏未登記的圖片。

---

## 6. 客戶查詢管理

### 6.1 查詢來源

當訪客點擊任何 WhatsApp CTA 按鈕時，`script.js` 會先透過 API 將資訊記錄到 KV，再打開 WhatsApp。即使訪客最後沒有發送 WhatsApp 訊息，後台也已留有記錄。

### 6.2 欄位說明

每個查詢卡片都是一個可編輯表單：

| 欄位 | 說明 |
|------|------|
| 稱呼 | 客戶姓名（可後補） |
| WhatsApp 號碼 | 核心識別欄位 |
| 電郵 | 可後補 |
| 公司 | 可後補 |
| 月營業額 | 可後補 |
| 查詢類型 | 可後補 |
| 訊息 / 備註 | 客戶訊息或 admin 備註 |
| 狀態 | pending / contacted / completed / closed |
| 內部備註 | 僅供內部查看 |

### 6.3 快速聯繫

每個查詢卡片右下角都有「WhatsApp 客戶」按鈕，點擊直接開啟對話。

---

## 7. 常見陷阱與注意事項

| 陷阱 | 後果 | 預防措施 |
|------|------|----------|
| 只改 HTML 沒改 Worker | 頁面閃一下新內容又變回舊的 | 強制四點同步 |
| 新增欄位但 Admin 沒加 | 用戶無法在後台編輯 | Admin Form First |
| 圖片沒用 `-stroke.png` | Dark Mode 下圖片看不見 | 所有透明 PNG 必須有 stroke 版本 |
| 忘了更新 `?v=` 版本號 | 用戶刷新還看到舊版 | 每次前端修改都升級版本號 |
| WhatsApp 號碼格式錯誤 | 連結無法打開 | 使用純數字國際格式，如 `85251164453` |
| 中文訊息未 encode | WhatsApp 訊息亂碼 | `encodeURIComponent()` 已內建於 `buildWhatsAppUrl()` |

---

## 8. 快速檢查清單（交付前必做）

在告訴別人「已完成」之前，請逐一確認：

- [ ] Admin 後台能看到新欄位的輸入框
- [ ] Worker `getDefaultCMSData()` 包含新欄位
- [ ] `index.html` 的靜態 fallback 是正確的
- [ ] `script.js` 的 render 函數有覆蓋新欄位
- [ ] 無痕視窗開啟網站，觀察 5 秒無閃爍
- [ ] Dark Mode 下文字和圖片都清晰可讀
- [ ] 如果有新增圖片，已確認 `-stroke.png` 版本存在
