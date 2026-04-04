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

## 管理後台
- **入口**：`admin.html`（已置於專案根目錄）
- **登入密碼**：`Admin360`
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
| `/api/inquiries` | GET | 查詢列表（需 `password`） |
| `/api/inquiries` | PUT | 更新查詢狀態（需 `password`） |
| `/api/analytics/pageview` | POST | 記錄頁面瀏覽 |
| `/api/analytics/interaction` | POST | 記錄互動事件 |
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
| `ADMIN_PASSWORD` | Worker Secret（值：Admin360） |
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
├── styles.css              # 樣式
├── admin.html              # 管理後台
├── merchant-checklist.html # 申請清單頁面
├── cms-worker/             # Cloudflare Worker
│   ├── src/index.js        # API 邏輯
│   ├── wrangler.toml       # Worker 設定（KV ID 已填入）
│   └── package.json
├── .github/workflows/
│   └── deploy.yml          # 自動部署 Pipeline
└── images/
    └── textless/           # 透明背景 PNG 素材
```

## 修改須知
- **純文字/價格修改**：直接登入 `admin.html` 修改 CMS JSON，無需重新部署 Pages。
- **HTML/CSS/JS 結構變更**：修改後 push 到 `master`，GitHub Actions 會自動部署 Pages 與 Worker。
- **新增圖片**：將圖片放入 `images/` 或 `images/textless/`，確保已加入 git index 後再 push。
