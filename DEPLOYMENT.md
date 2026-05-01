# CWMNG 部署與維運手冊

本文檔說明如何部署、更新與故障排除。

---

## 1. CI/CD 流程

### 1.1 自動觸發條件

推送到 `master` 或 `main` 分支時，`.github/workflows/deploy.yml` 會自動：

1. **先部署 Worker** (`deploy-worker` job)
2. **再部署 Pages** (`deploy-pages` job，依賴 worker 完成)

### 1.2 手動觸發

在 GitHub Actions 頁面選擇 `deploy.yml`，點擊 **Run workflow**。

或者從 Admin 後台點擊「一鍵部署」，會呼叫 Worker API 觸發 GitHub Actions。

---

## 2. 環境變數與 Secrets

### 2.1 GitHub Secrets（已配置）

| Secret | 用途 |
|--------|------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token（部署用） |
| `CLOUDFLARE_ACCOUNT_ID` | `dfbee5c2a5706a81bc04675499c933d4` |

### 2.2 Worker Secrets（已配置）

這些是 Worker 運行時需要的环境变量，通過 `wrangler secret put` 設置：

| Secret | 用途 |
|--------|------|
| `ADMIN_PASSWORD` | Admin 後台登入密碼（值：`Maid360`） |
| `GITHUB_TOKEN` | 觸發 GitHub Actions 的 Personal Access Token |

> ⚠️ **注意**：`GITHUB_TOKEN` 已設為本機 User 環境變數，PowerShell 可調用 `$env:GITHUB_TOKEN`。實際 Token 值**不可**寫入版本控制。

### 2.3 wrangler.toml

```toml
name = "cwmng-cms-worker"
main = "src/index.js"
compatibility_date = "2025-01-01"

[[kv_namespaces]]
binding = "CMS_DATA"
id = "2494ec74390a4baabe68f0de374d822b"
```

---

## 3. 本地開發指令

### 3.1 純前端預覽

```powershell
# Python 3
python -m http.server 8080

# 或 Node.js
npx serve .
```

### 3.2 Worker 本地開發

```powershell
cd cms-worker
npx wrangler dev
```

Worker 會在 `http://localhost:8787` 運行。

`script.js` 和 `admin.html` 中的 API URL 會自動檢測 `localhost` 並連到 `http://localhost:8787`。

### 3.3 部署 Worker（通常不需要手動）

```powershell
cd cms-worker
npx wrangler deploy
```

---

## 4. 修改不同類型內容的部署策略

| 修改類型 | 需要修改的檔案 | 是否需要 Push |
|----------|----------------|---------------|
| **純文字 / 價格** | `admin.html`（後台表單）+ `cms-worker/src/index.js` | ❌ 不需要（改 CMS 即可實時生效） |
| **新增 CMS 欄位** | 四點同步（Worker / Admin / HTML / JS） | ✅ 需要 |
| **HTML/CSS/JS 結構** | `index.html` / `styles.css` / `script.js` | ✅ 需要 |
| **新增圖片** | 放入 `images/` 資料夾 | ✅ 需要 |
| **修改 Worker 邏輯** | `cms-worker/src/index.js` | ✅ 需要 |

---

## 5. Cache Busting

每次修改前端檔案後，**必須**更新引用時的 `?v=` 版本號：

```html
<!-- index.html -->
<link rel="stylesheet" href="styles.css?v=23">
<script src="script.js?v=22"></script>
```

這樣才能確保用戶刷新時拿到最新檔案，而不是 CDN 快取中的舊版。

---

## 6. 故障排除

### 6.1 頁面內容「閃一下又變回舊的」

**症狀**：新內容出現 0.5 秒後消失，變回舊內容。

**診斷步驟**：
1. 檢查 `cms-worker/src/index.js` 的 `getDefaultCMSData()` 是否已更新
2. 檢查 KV 中是否存了舊資料
3. 確認 Worker 的 `deepMerge` 正常運作
4. 檢查 `index.html` 的 fallback 是否正確

**解決**：遵循四點同步原則，同時更新所有相關檔案。

### 6.2 Admin 後台載入不到查詢記錄

**症狀**：Inquiries 頁面一直顯示「載入中」或「載入失敗」。

**診斷**：Admin 後台使用的是 `POST /api/inquiries/list`，不是公開的 `POST /api/inquiries`。檢查 Worker 路由是否正確。

### 6.3 部署失敗

**診斷步驟**：
1. 到 GitHub Actions 查看錯誤日誌
2. 常見原因：
   - `CLOUDFLARE_API_TOKEN` 過期
   - `wrangler.toml` 語法錯誤
   - Worker 代碼有 Syntax Error

### 6.4 WhatsApp 連結無法打開

**診斷**：
1. 檢查 `site.whatsappNumber` 是否為純數字（如 `85251164453`）
2. 檢查中文訊息是否經過 `encodeURIComponent`
3. 確認 `bindWhatsAppLinks()` 在 `renderCMS()` 後被呼叫

### 6.5 Dark Mode 下圖片看不見

**診斷**：
- 檢查圖片路徑是否使用 `-stroke.png` 版本
- 檢查 `styles.css` 中 `[data-theme="dark"]` 的 filter 設定

---

## 7. 聯絡與支援

- **專案 Repo**: `https://github.com/twmeric/cwmng`
- **開發方**: JKD Coding
