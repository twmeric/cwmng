# CWMNG 技術架構文檔

本文檔面向後續維護的工程師，說明 CWMNG 的整體技術架構、資料流與關鍵設計決策。

---

## 1. 整體架構

```
┌─────────────────────────────────────────────────────────────┐
│                         用戶瀏覽器                          │
│  ┌──────────────┐      ┌──────────────┐                    │
│  │ Static HTML  │◄────►│   script.js  │                    │
│  │ (Pages CDN)  │      │ (CMS Render) │                    │
│  └──────────────┘      └──────┬───────┘                    │
│         ▲                     │                             │
│         │                     ▼                             │
│  ┌──────┴──────┐      ┌─────────────────┐                  │
│  │ admin.html  │◄────►│  Cloudflare     │                  │
│  │ (後台管理)   │      │  Worker API     │                  │
│  └─────────────┘      └────────┬────────┘                  │
│                                │                            │
│                                ▼                            │
│                         ┌─────────────┐                     │
│                         │ Cloudflare  │                     │
│                         │ KV Storage  │                     │
│                         └─────────────┘                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 前端架構

### 2.1 頁面組成

| 頁面 | 用途 | 特殊說明 |
|------|------|----------|
| `index.html` | 主 Landing Page | 含完整 SEO Schema、FAQPage JSON-LD、Open Graph |
| `admin.html` | 管理後台 | Tailwind CDN、FontAwesome、內嵌大量 JS |
| `merchant-checklist.html` | 申請清單獨立頁 | 供外部推廣使用 |
| `privacy-policy.html` | 隱私政策 | 統一使用 `styles.css` 的 `.legal-page` 樣式 |
| `terms-of-service.html` | 服務條款 | 同上 |

### 2.2 樣式系統（styles.css）

採用 **CSS 變數** 實現 Light / Dark 模式切換：

```css
:root {
  --bg-body: #fafafa;
  --bg-section: #ffffff;
  --text-primary: #18181b;
  --accent-gold: #d4a853;
  --accent-blue: #1E3A8A;
  /* ... */
}

[data-theme="dark"] {
  --bg-body: #0a0a0a;
  --bg-section: #111111;
  --text-primary: #fafafa;
  /* ... */
}
```

**關鍵設計**：
- 所有插圖使用透明背景 PNG
- Dark Mode 下使用 `-stroke.png` 版本（內建白色描邊）
- Logo 在 Dark Mode 下使用 `drop-shadow` 模擬白色描邊效果

### 2.3 JS 核心模組（script.js）

```
script.js
├── initTheme()              # 主題切換（localStorage + prefers-color-scheme）
├── initBaseInteractions()   # Scroll progress, Navbar, Reveal animations, FAQ
├── initHeroSlider()         # Hero 圖片輪播（4秒自動切換）
├── initPricingCalculator()  # 手續費計算機（互動式）
├── fetchCMSData()           # 從 Worker 載入 CMS JSON
├── renderCMS()              # 分發到各區塊 render 函數
│   ├── renderSiteMeta()
│   ├── renderNav()
│   ├── renderHero()
│   ├── renderProblems()
│   ├── renderSolutions()
│   ├── renderPricing()
│   ├── renderTestimonials()
│   ├── renderFAQ()
│   ├── renderCTA()
│   ├── renderFooter()
│   └── renderStickyCta()
├── bindWhatsAppLinks()      # 統一將 .wa-cta 綁定到 WhatsApp deeplink
└── Analytics (trackPageView, trackEvent)
```

---

## 3. 後端架構（Cloudflare Worker）

### 3.1 路由表

```javascript
GET  /api/cms/data          → 讀取 CMS 內容（公開）
POST /api/cms/data          → 儲存 CMS 內容（需 password）
POST /api/inquiries         → 客戶提交查詢（公開）
GET  /api/inquiries         → 查詢列表（需 password，向後兼容）
POST /api/inquiries/list    → 查詢列表（需 password，推薦）
PUT  /api/inquiries         → 更新查詢狀態（需 password）
POST /api/analytics/pageview     → 記錄頁面瀏覽
POST /api/analytics/interaction  → 記錄互動事件
POST /api/analytics/report       → 獲取分析報告（需 password）
POST /api/deploy            → 觸發 GitHub Actions 部署（需 password）
POST /api/auth              → 驗證管理員密碼
```

### 3.2 KV 資料結構

| Key Prefix | 用途 | TTL |
|------------|------|-----|
| `cms_data` | 當前 CMS JSON | 永久 |
| `cms_history_*` | CMS 修改歷史 | 30 天 |
| `inquiry_*` | 客戶查詢記錄 | 永久 |
| `analytics_pv_*` | PageView 記錄 | 90 天 |
| `analytics_int_*` | Interaction 記錄 | 90 天 |

### 3.3 deepMerge 保護機制

這是專案最關鍵的防禦機制之一：

```javascript
const merged = deepMerge(defaults, data);
```

**問題**：舊 KV 資料缺少新欄位時，前端 render 後會把 fallback 覆蓋掉，導致內容「閃一下就不見」。

**解決**：`deepMerge` 會以 `defaults` 為基準，遞迴補全 `stored` 中缺少的欄位和陣列元素。

**陣列合併邏輯**：
- 以 `defaults` 的長度為基準
- `stored[i]` 存在的話，遞迴合併；不存在的話，使用 default
- 這確保新增陣列元素（如 FAQ、Testimonials）不會被舊資料截斷

---

## 4. CMS 資料流

### 4.1 頁面載入流程

```
1. 瀏覽器請求 index.html
2. Cloudflare Pages 回傳靜態 HTML（含 fallback 內容）
3. script.js 執行 fetchCMSData()
4. Worker 讀取 KV → deepMerge(defaults, stored)
5. script.js 收到完整 JSON
6. renderCMS() 逐個覆蓋 DOM
7. bindWhatsAppLinks() 更新所有 CTA 連結
```

### 4.2 為什麼會「閃一下」？

如果用戶看到：
- 先顯示新內容（HTML fallback）
- 然後變回舊內容（CMS render 覆蓋）

**根因通常是**：
1. 只改了 `index.html`，沒改 Worker `getDefaultCMSData()`
2. 或 KV 中的舊資料缺少新欄位，且 Worker 沒做 deepMerge

**這就是「四點同步原則」存在的理由。**

---

## 5. WhatsApp CTA 架構

### 5.1 前端機制

所有 CTA 按鈕統一使用 `.wa-cta` class，或帶有 `.open-modal` / `.open-checklist` class。

`bindWhatsAppLinks()` 會：
1. 遍歷所有目標元素
2. 讀取 `textContent` 作為預設訊息
3. 呼叫 `buildWhatsAppUrl(text)`
4. 設定 `href` 為 `https://wa.me/{號碼}?text={encodeURIComponent(訊息)}`

### 5.2 CMS 管理點

在 Admin 後台的「網站資訊」tab 可修改：
- `site.whatsappNumber` - WhatsApp 號碼
- `site.whatsappDefaultMessage` - 預設訊息（當按鈕沒有文字時使用）

---

## 6. 圖片資產規範

### 6.1 活躍圖片清單

所有被代碼直接引用的圖片：

| 檔案 | 用途 |
|------|------|
| `images/logo.png` | Navbar / Footer / OG Image |
| `images/jkd-logo.png` | merchant-checklist 頁尾 |
| `images/textless/216808905.png` | Admin 後台 Logo |
| `images/textless/216808905A.png` ~ `C.png` | 媒體庫原始檔 |
| `images/textless/216808905A-stroke.png` ~ `C-stroke.png` | Hero Slider |
| `images/textless/190514290-stroke.png` | Problems 卡片 1 |
| `images/textless/230569377-stroke.png` | Problems 卡片 2 |
| `images/textless/242460541-stroke.png` | Problems 卡片 3 |
| `images/textless/242354730-stroke.png` | Process 區塊 |
| `images/textless/134950753-stroke.png` | Checklist 區塊 |
| `images/textless/156545017-stroke.png` | CTA 區塊 |

### 6.2 -stroke.png 規範

為了讓透明 PNG 在 dark mode 下可讀：
- 所有頁面用圖必須是 `-stroke.png` 版本
- 白色 2-3px 外描邊
- Admin 後台和 Worker 預設值都必須引用 `-stroke.png`

---

## 7. Analytics 設計

採用 **無侵入式埋點**：

### 7.1 PageView

- 頁面載入時自動發送
- 記錄：`page`, `referrer`, `userAgent`, `sessionId`, `country` (CF-IPCountry)

### 7.2 Interaction

- WhatsApp 按鈕點擊自動觸發
- 記錄：`type`, `element`, `page`, `value`, `sessionId`

### 7.3 Session ID

使用 `sessionStorage` 生成：`sess_${timestamp}_${random}`，同一標籤頁內保持一致。

### 7.4 限制

KV `list()` 每次最多回傳 1000 條 key。對於小型 landing page，90 天內通常不會超過此限制。

---

## 8. 安全設計

1. **CORS**：Worker 允許所有來源（`*`），因為是公開 API
2. **Auth**：管理端點統一檢查 `body.password === env.ADMIN_PASSWORD`
3. **No SQL Injection**：KV 是 key-value 存儲，不存在 SQL 注入風險
4. **Input Validation**：`saveInquiry` 只要求 `phone` 欄位

---

## 9. 關鍵代碼位置速查

| 功能 | 檔案 | 函數 / 位置 |
|------|------|-------------|
| CMS 預設資料 | `cms-worker/src/index.js` | `getDefaultCMSData()` |
| CMS 載入 | `script.js` | `fetchCMSData()` |
| CMS 渲染分發 | `script.js` | `renderCMS()` |
| Hero 輪播 | `script.js` | `initHeroSlider()` |
| 計算機 | `script.js` | `initPricingCalculator()` |
| WhatsApp 連結 | `script.js` | `buildWhatsAppUrl()`, `bindWhatsAppLinks()` |
| Admin 表單 | `admin.html` | `renderContentForms()` |
| Admin 儲存 | `admin.html` | `saveCMSData()` |
| deepMerge | `cms-worker/src/index.js` | `deepMerge()` |
