# CWMNG 母機守則 / Agent Guide

## 項目概覽
- **專案名稱**：CWMNG（駿匯聯 C&W Management）
- **類型**：Landing Page + CMS + Leads Capture
- **GitHub Repo**：`https://github.com/twmeric/cwmng`
- **部署平台**：Cloudflare Pages + Cloudflare Workers + KV

## 技術架構
```
Frontend (Pages)          Backend (Worker)           Storage (KV)
    │                          │                          │
    ▼                          ▼                          ▼
┌──────────────┐      ┌─────────────────┐      ┌─────────────────┐
│ Static HTML  │──────▶│ cwmng-cms-worker│──────▶│ CMS_DATA        │
│ CSS + JS     │◀──────│ Cloudflare Edge │◀──────│ Key-Value Store │
└──────────────┘  JSON └─────────────────┘      └─────────────────┘
```

## 關鍵網址
| 服務 | 網址 |
|------|------|
| 生產環境 (Pages) | `https://cwmng.jkdcoding.com` |
| 生產環境 (備用) | `https://4293ad0c.cwmng.pages.dev` |
| CMS Worker API | `https://cwmng-cms-worker.jimsbond007.workers.dev` |
| 管理後台 | `https://cwmng.jkdcoding.com/admin.html` |

---

## ⚠️ 母機檢討與慘痛教訓（必讀）

### 2025-04-04 會議核心教訓
本次會議中，母機團隊在 CWMNG 專案的 CMS 與 Admin 後台工作上表現嚴重失準，反覆返工多達 **5-6 次**，浪費用戶大量時間。以下為必須刻入記憶的教訓，後續所有類似專案不得再犯。

#### 教訓 1：Admin CMS 界面不可只剩「JSON 編輯器」
用戶最憤怒的點：**我們居然用「原始 JSON 編輯器」作為 CMS 內容管理的主要界面**。e-corp 的 Admin 後台明明有分段式、所見即所得的表單界面（Hero / Solutions / Pricing / FAQ / CTA 等獨立 tab 與欄位），但我們在 CWMNG 中只提供了簡陋的 JSON textarea，這是徹頭徹尾的偷工減料。

**強制規定**：
- Admin CMS 必須提供**分段表單界面**，每個區塊（Hero / Solutions / Pricing / FAQ / CTA / Testimonials）都要有獨立欄位。
- JSON 編輯器只能作為**進階 fallback**，不能是唯一入口。
- 表單欄位必須支援 `input`、`textarea`、`select`、`image URL`，並且要有明確的 `label` 與 `placeholder`。

#### 教訓 2：內容修改必須「CMS First」
當專案架構是 **CMS 資料覆蓋靜態 HTML** 時，任何文案修改都必須**優先修改 CMS 源頭**（Worker `getDefaultCMSData()` 或 Admin CMS 表單），同時同步更新靜態 HTML fallback。

我們只改了 `index.html` 卻沒改 Worker 預設值，導致頁面載入後 `renderHero()` 把舊資料覆蓋回來，用戶看到「紅色閃了一下又變回黑色」。

**強制規定**：
- 動手前必須先問：「這個元素是 CMS 驅動的，還是純 HTML 寫死的？」
- 如果是 CMS 驅動，修改順序必須是：**Worker `getDefaultCMSData()` → Admin CMS 表單 → `index.html` fallback → `script.js` render function（如有必要）**
- 四點必須同步修改，缺一不可。

#### 教訓 3：Admin 後台的基礎樣式不可有暗色缺陷
Admin 後台的表單文字在 dark mode 下變成黑色（因為 `body` 沒設定預設 `color`，而 `input` 繼承了瀏覽器預設黑色）。這代表我們連 CSS 變數的基礎檢查都沒做。

**強制規定**：
- Admin CSS 必須完整定義 light / dark 模式下的 `body color`、`input color`、`textarea color`、`table text color`。
- 後台必須在 dark mode 下完整測試過可讀性。

#### 教訓 4：API 路由設計要區分「公開」與「管理」
我們讓 Admin 後台用 `POST /api/inquiries` 去撈查詢列表，但這個端點在 Worker 裡是「客戶公開提交表單」的入口。結果 Admin 送 `{ password }` 過去被當成不完整查詢擋掉，導致後台永遠看不到記錄。

**強制規定**：
- 管理後台專用的 API 端點必須與公開端點**分離路由**。
- 例如：公開提交用 `POST /api/inquiries`，後台列表用 `POST /api/inquiries/list` 或 `GET /api/inquiries`（帶 auth header）。
- 絕對不允許讓管理動作用同一個 body schema 去撞公開端點。

#### 教訓 5：減少碎片化部署
我們在短時間內把 cache-busting 版本號從 `?v=2` 改到 `?v=7`，推送了 5-6 次 commit。這證明每次修改都沒有做端到端驗證。

**強制規定**：
- 相關修改必須**打包成一次完整的 commit/push**。
- 推送前必須完成「三點驗證」：源頭正確 → fallback 正確 → `curl` 檢查 production HTML 輸出正確。
- 如果需要推第二次，必須在回覆中主動檢討為什麼第一次沒做對。

---

## CMS 驅動網站開發 SOP

### Phase 1：動手修改前的強制檢查清單
在修改任何內容或樣式之前，必須在腦中（或回覆中）回答以下問題：

1. **這個元素的最終資料源是什麼？**
   - CMS JSON（Worker KV）
   - 純靜態 HTML
   - JS 硬編碼
2. **如果是 CMS 驅動，render 函數在哪？**
   - 找到 `script.js` 裡對應的 `renderXxx()` 函數
   - 確認它會覆蓋哪些 DOM 元素
3. **是否需要修改 Worker 預設值？**
   - 打開 `cms-worker/src/index.js` → `getDefaultCMSData()`
   - 確認對應欄位的預設值是否正確
4. **Admin 後台是否有對應的表單欄位？**
   - 如果沒有，必須新增，不能讓用戶只能靠 JSON 編輯

### Phase 2：修改時的四點同步原則
當修改 CMS 驅動的內容時，以下四個點必須同步更新：

| 位置 | 作用 | 例子 |
|------|------|------|
| `cms-worker/src/index.js` | Worker 回傳的預設 CMS 資料 | `getDefaultCMSData().hero.title` |
| `admin.html` | 後台可視化編輯表單 | `renderHeroForm()` / `inputRow()` |
| `index.html` | 靜態 fallback（SEO / No-JS） | `.hero-content h1` |
| `script.js` | 動態 render 邏輯（如有變更） | `renderHero()` |

### Phase 3：推送前的三點驗證
1. **源頭驗證**：本地查看 Worker `getDefaultCMSData()` 的 JSON 內容是否正確
2. **靜態驗證**：查看 `index.html` 裡的 hard-coded 內容是否正確
3. **線上驗證**：
   - 部署後用 `curl https://cwmng.jkdcoding.com | findstr "關鍵字"` 確認輸出
   - 用瀏覽器無痕視窗開啟，觀察 3-5 秒確認沒有被 CMS 覆蓋回舊值

---

## Admin 後台界面最低標準

以下為任何 CMS 網站專案的 Admin 後台必須滿足的最低要求。若未達標，視為偷工減料。

1. **必須提供分段式 CMS 表單**
   - 每個頁面區塊（Hero / Solutions / Pricing / FAQ / CTA / Testimonials / Footer）要有獨立 tab 或區塊
   - 每個欄位要有清楚的 `label` 與 `placeholder`
2. **JSON 編輯器只能作為進階選項**
   - 必須藏在「原始 JSON」或「進階編輯」tab 下
   - 不能是唯一或主要入口
3. **Inquiry / Analytics 管理**
   - 查詢列表必須可篩選、可更新狀態、可寫備註
   - Analytics 必須顯示數字卡片與圖表趨勢（至少要有 pageviews / interactions / sessions）
4. **Dark Mode 完整性**
   - 所有輸入框、表格、文字在 dark mode 下必須清晰可讀
   - 必須測試過 `data-theme="dark"` 狀態
5. **一鍵部署**
   - Admin 必須有「部署到生產環境」按鈕，觸發 GitHub Actions

---

## 常見陷阱清單（反覆出錯點）

| 陷阱 | 後果 | 預防措施 |
|------|------|----------|
| 只改 HTML 沒改 Worker `getDefaultCMSData()` | 頁面閃一下新內容又變回舊的 | 強制執行「四點同步」 |
| Worker 沒做 deep merge，舊 KV 資料缺少新欄位 | 新內容（如 Footer 地址）閃一下就被舊 JSON 覆蓋消失 | Worker `getCMSData()` 必須將 KV 資料與 `getDefaultCMSData()` 做遞迴合併 |
| Admin 用公開 API 撈管理資料 | 永遠載入失敗或資料不完整 | 分離路由，管理端點獨立 |
| Admin 只有 JSON 編輯器 | 用戶無法直覺修改，容易改壞 | 必須提供分段表單 |
| `body { color: ... }` 沒定義 | dark mode 下文字變黑色 | 完整定義 light/dark 基礎色 |
| 忘了加 `?v=` cache-busting | 用戶刷新還是看到舊版 | 每次前端修改都升級版本號 |
| `fetch().catch(() => {})` 靜默吞錯 | 出問題完全不知道 | 至少保留 `console.error` |

---

## 管理後台
- **入口**：`admin.html`（已置於專案根目錄）
- **登入密碼**：`Maid360`
- **功能**：
  - CMS JSON 內容即時編輯與儲存
  - 查看/管理客戶查詢（Inquiries）
  - 更新查詢狀態（pending / contacted / completed / closed）與備註
  - 手動觸發 GitHub Actions 重新部署

## API 端點
| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/cms/data` | GET | 讀取 CMS 內容 |
| `/api/cms/data` | POST | 儲存 CMS 內容（需 `password`） |
| `/api/inquiries` | POST | 客戶提交查詢（公開） |
| `/api/inquiries/list` | POST | 查詢列表（需 `password`） |
| `/api/inquiries` | PUT | 更新查詢狀態（需 `password`） |
| `/api/analytics/pageview` | POST | 記錄頁面瀏覽 |
| `/api/analytics/interaction` | POST | 記錄互動事件 |
| `/api/analytics/report` | POST | 獲取分析報告（需 `password`） |
| `/api/deploy` | POST | 觸發 Pages 部署（需 `password`） |

## 客戶留痕（Leads Capture）
網站設有兩個表單入口：
1. **一般諮詢**（`open-modal`）— 收集姓名、電話、電郵、公司、月營業額
2. **索取清單**（`open-checklist`）— 收集姓名、電話、電郵、公司

**流程**：客戶填表 → 資料**先存入 Worker KV** → 再打開 WhatsApp deeplink。即使客戶未送出 WhatsApp，後台已留有完整資料可供跟進。

## CI/CD 與 Secrets
### GitHub Actions
- **Workflow**：`.github/workflows/deploy.yml`
- **觸發條件**：`push` 到 `master` / `main`
- **部署順序**：
  1. 先部署 `cms-worker`
  2. 再部署 Cloudflare Pages

### 已配置的 GitHub Secrets
| Secret | 說明 |
|--------|------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token |
| `CLOUDFLARE_ACCOUNT_ID` | `dfbee5c2a5706a81bc04675499c933d4` |

### Worker Secrets（已上傳）
| Secret | 來源 |
|--------|------|
| `ADMIN_PASSWORD` | Worker Secret（值：Maid360） |
| `GITHUB_TOKEN` | Worker Secret + 本機 User 環境變數 |

> ⚠️ **注意**：`GITHUB_TOKEN` 已設為本機 User 環境變數，PowerShell 可直接調用 `$env:GITHUB_TOKEN`。實際 Token 值請勿寫入版本控制。

## 本地開發指令
```powershell
# 進入 Worker 目錄
cd cms-worker

# 本地開發
cd cms-worker
npx wrangler dev

# 部署 Worker（通常由 GitHub Actions 自動處理）
cd cms-worker
npx wrangler deploy
```

## 重要檔案結構
```
CWMNG/
├── index.html              # 主頁（含 Modal 表單）
├── script.js               # CMS 動態載入 + Leads Capture + Analytics
├── styles.css              # 樣式（含 dark mode 變數與組件動畫）
├── admin.html              # 管理後台（分段式表單 + JSON 進階編輯）
├── merchant-checklist.html # 申請清單頁面
├── privacy-policy.html     # 隱私政策
├── terms-of-service.html   # 服務條款
├── cms-worker/             # Cloudflare Worker
│   ├── src/index.js        # API 邏輯（含 deepMerge 保護）
│   ├── wrangler.toml       # Worker 設定（KV ID 已填入）
│   └── package.json
├── .github/workflows/
│   └── deploy.yml          # 自動部署 Pipeline
└── images/
    ├── logo.png            # 主品牌 Logo
    ├── jkd-logo.png        # merchant-checklist 頁尾 Powered By 圖示
    └── textless/           # 透明背景 PNG 素材（已清理，僅保留線上使用檔案）
```

## 圖片資產管理規範

### 當前活躍圖片清單
以下為**唯一**被代碼直接引用的圖片，其餘檔案已於 2026-04 清理移除：

| 檔案 | 用途 |
|------|------|
| `images/logo.png` | Navbar / Footer / OG Image / merchant-checklist |
| `images/jkd-logo.png` | merchant-checklist 頁尾 Powered By |
| `images/textless/216808905.png` | Admin 後台 Logo/Avatar |
| `images/textless/216808905A.png` | 吉祥物 A（媒體庫原始檔） |
| `images/textless/216808905B.png` | 吉祥物 B（媒體庫原始檔） |
| `images/textless/216808905C.png` | 吉祥物 C（媒體庫原始檔） |
| `images/textless/216808905A-stroke.png` | Hero Slider（深色模式可讀） |
| `images/textless/216808905B-stroke.png` | Hero Slider（深色模式可讀） |
| `images/textless/216808905C-stroke.png` | Hero Slider（深色模式可讀） |
| `images/textless/190514290-stroke.png` | Solutions 卡片插圖 |
| `images/textless/230569377-stroke.png` | Solutions 卡片插圖 |
| `images/textless/242460541-stroke.png` | Solutions 卡片插圖 |
| `images/textless/242354730-stroke.png` | Process 區塊插圖 |
| `images/textless/134950753-stroke.png` | Checklist 區塊插圖 |
| `images/textless/156545017-stroke.png` | CTA 區塊插圖 |

### `-stroke.png` 生成規範
為了讓透明背景 PNG 在 dark mode 下仍可讀（黑色文字/線條不會融入深色背景），所有用於頁面的透明插圖都必須準備帶**白色描邊**的 `-stroke.png` 版本：
- 白色 2-3px 外描邊
- 檔名格式：`{original}-stroke.png`
- 引用時優先使用 `-stroke.png`（HTML fallback 與 Worker `getDefaultCMSData()` 均需同步）

### 已清理資產
- `images/jamestyle/` — 約 150+ 張 WhatsApp 原始圖 dump 與亂碼檔名舊素材，已全數移除
- `images/textless/` 中所有 `.jpg`、未使用 `.png`、WhatsApp `.jpeg` 檔案，已全數移除
- `images/textless_raw/` — 空資料夾，已移除

## 修改須知
- **純文字/價格修改**：登入 `admin.html` 修改 CMS 內容，無需重新部署 Pages。
- **HTML/CSS/JS 結構變更**：修改後 push 到 `master`，GitHub Actions 會自動部署 Pages 與 Worker。
- **新增圖片**：將圖片放入 `images/` 或 `images/textless/`，確保已加入 git index 後再 push。
- **任何 CMS 相關修改**：務必遵循本文件「CMS 驅動網站開發 SOP」與「四點同步原則」。
- **Dark Mode 插圖修改**：若替換透明 PNG，必須同時生成或更新 `-stroke.png` 版本，並同步 Worker / HTML / Admin 三處路徑。

## WhatsApp CTA 與客戶查詢架構（2026-04 更新）

### 前端 CTA 機制
- **所有頁面 CTA 按鈕**（包括 `.open-modal` 與 `.open-checklist`）已統一改為 **WhatsApp deep link**。
- 點擊後**不再彈出填表 Modal**，直接開啟 WhatsApp 對話。
- **Button 文字即為預設訊息**：`script.js` 會自動將按鈕的 `textContent` 編碼後帶入 `https://wa.me/{號碼}?text={訊息}`。
- WhatsApp 號碼與預設訊息在 CMS `site.whatsappNumber` / `site.whatsappDefaultMessage` 中管理，Admin 後台可直接修改。

### Inquiry（客戶查詢）簡化
- 由於前端不再透過表單收集詳細資料，**Inquiry 系統以「WhatsApp 號碼」為唯一核心欄位**。
- `saveInquiry` API 已放寬驗證：`phone` 為必填，`name` 改為 optional。
- Admin 後台的客戶查詢卡片已改為**可編輯表單**：admin 可在後台直接補充 `name`、`email`、`company`、`monthlyRevenue`、`interest`、`message` 與 `notes`。
- `updateInquiry` API 已擴展為支援更新上述所有欄位。

### 修改 CTA 時的四點同步
若新增或修改任何頁面區塊的 CTA 按鈕，請務必同步：
1. `cms-worker/src/index.js` → `getDefaultCMSData()` 中對應區塊的 `cta` 文字
2. `admin.html` → 對應區塊的表單欄位
3. `index.html` → fallback 按鈕文字與預設 WhatsApp URL
4. `script.js` → 若為動態渲染區塊（如 `renderPricing`、`renderFAQ`），需確保生成 `.wa-cta` 與 `buildWhatsAppUrl(...)`
