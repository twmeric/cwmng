# CWMNG（駿匯聯 C&W Management）

> 香港支付閘道 Landing Page + CMS + 客戶留痕系統

---

## 快速連結

| 環境 | 網址 |
|------|------|
| 生產環境 | `https://cwmng.jkdcoding.com` |
| 生產環境（備用） | `https://4293ad0c.cwmng.pages.dev` |
| 管理後台 | `https://cwmng.jkdcoding.com/admin.html` |
| CMS Worker API | `https://cwmng-cms-worker.jimsbond007.workers.dev` |

---

## 專案簡介

CWMNG 是一個為駿匯聯（C&W Management）打造的企業級 Landing Page，核心功能包括：

1. **Landing Page** - 靜態 HTML 頁面，含 SEO、Dark Mode、響應式設計
2. **CMS 內容管理** - 透過 Cloudflare Worker + KV 動態載入內容，Admin 後台可視化編輯
3. **客戶留痕（Leads Capture）** - 所有 CTA 導向 WhatsApp，點擊前自動記錄到 KV
4. **網站分析** - 基礎的 PageView / Interaction 統計
5. **一鍵部署** - GitHub Actions 自動部署 Pages + Worker

---

## 技術棧

```
Frontend:    Static HTML + CSS + Vanilla JS (Zero Framework)
Backend:     Cloudflare Workers (JavaScript)
Storage:     Cloudflare KV
CDN:         Cloudflare Pages
CI/CD:       GitHub Actions
Icons:       Phosphor Icons
Admin CSS:   Tailwind CSS (CDN)
```

---

## 目錄結構

```
CWMNG/
├── index.html              # 主頁（含完整 SEO Schema）
├── script.js               # 核心 JS：CMS 渲染 + 互動 + Analytics
├── styles.css              # 全局樣式（含 Dark Mode 變數）
├── admin.html              # 管理後台（分段式 CMS 表單）
├── merchant-checklist.html # 申請清單頁面
├── privacy-policy.html     # 隱私政策
├── terms-of-service.html   # 服務條款
├── sitemap.xml             # 網站地圖
├── robots.txt              # 爬蟲規則
├── images/                 # 圖片資產
│   ├── logo.png
│   ├── jkd-logo.png
│   └── textless/           # 透明背景插圖（含 -stroke 版本）
├── cms-worker/             # Cloudflare Worker
│   ├── src/index.js        # API 邏輯 + getDefaultCMSData()
│   ├── wrangler.toml       # Worker 設定
│   └── package.json
├── .github/workflows/
│   └── deploy.yml          # 自動部署 Pipeline
├── AGENTS.md               # AI Agent 操作守則（重要！）
├── ARCHITECTURE.md         # 技術架構詳解
├── DEPLOYMENT.md           # 部署與維運手冊
├── CMS_GUIDE.md            # CMS 內容管理指南
└── README.md               # 本文件
```

---

## 文件導航

| 文件 | 適合讀者 | 內容 |
|------|----------|------|
| `AGENTS.md` | AI / 開發助手 | **必讀**。包含專案慘痛教訓、四點同步原則、Admin 最低標準 |
| `ARCHITECTURE.md` | 新進工程師 | 技術架構、資料流、API 說明、render 機制 |
| `DEPLOYMENT.md` | 維運人員 | Secrets 清單、部署步驟、本地開發、故障排除 |
| `CMS_GUIDE.md` | 內容編輯 / 業主 | Admin 後台使用說明、改文案 SOP、常見陷阱 |

---

## 快速開始

### 本地預覽（純前端）

由於是靜態網站，直接用任何靜態伺服器即可：

```bash
# Python
python -m http.server 8080

# Node.js
npx serve .

# PowerShell
php -S localhost:8080
```

然後開啟 `http://localhost:8080`

### Worker 本地開發

```bash
cd cms-worker
npx wrangler dev
```

Worker 會在 `http://localhost:8787` 運行，此時 `script.js` 會自動連接到本地 API。

---

## 黃金法則：四點同步原則

當你要修改任何 CMS 驅動的內容時，**必須同步修改以下四個點**：

1. `cms-worker/src/index.js` → `getDefaultCMSData()`
2. `admin.html` → 對應表單欄位
3. `index.html` → fallback 靜態內容
4. `script.js` → render 邏輯（如有變更）

> 詳見 `AGENTS.md` 與 `CMS_GUIDE.md`

---

## Admin 後台

- **網址**: `/admin.html`
- **密碼**: `Maid360`
- **功能**: CMS 編輯、客戶查詢管理、Analytics、一鍵部署

---

## 版權

© 駿匯聯有限公司 C&W Management Limited  
Powered by [JKD Coding](https://jkdcoding.com)
