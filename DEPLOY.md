# Cloudflare Pages 部署指南

## 已完成的設置

- GitHub Repository: https://github.com/twmeric/cwmng
- CI/CD Workflow: `.github/workflows/deploy.yml`
- 本地快速部署腳本: `deploy.bat`
- 原始圖片素材已排除在部署之外（`images/jamestyle/` 加入 `.gitignore`）

## 下一步：獲取 Cloudflare 憑證

### 1. 獲取 Account ID
登入 Cloudflare Dashboard → 右側邊欄即可看到 **Account ID**。

### 2. 創建 API Token
1. 登入 Cloudflare → My Profile → API Tokens
2. 點擊 **Create Token** → 使用 **Custom token**
3. 權限設置：
   - `Cloudflare Pages: Edit`
   - `Account: Read`
   - `Zone: Read`（如需要自訂網域）
4. 複製 Token

### 3. 設置 GitHub Secrets
進入 GitHub Repo → Settings → Secrets and variables → Actions → New repository secret：

| Secret Name | Value |
|-------------|-------|
| `CLOUDFLARE_API_TOKEN` | 你的 API Token |
| `CLOUDFLARE_ACCOUNT_ID` | 你的 Account ID |

設置完成後，推送任意更改到 `master` 分支即可自動觸發部署。

## 自訂網域設置

目標網域：`cwmng.jkdcoding.com`

### 方法 A：透過 Cloudflare Dashboard（推薦）
1. 首次部署成功後，進入 Cloudflare Dashboard → Workers & Pages → `cwmng`
2. 點擊 **Custom domains** → **Set up a custom domain**
3. 輸入 `cwmng.jkdcoding.com`
4. Cloudflare 會自動為 `jkdcoding.com` 新增一條 CNAME 記錄（如果該網域已託管在 Cloudflare）
5. 等待 SSL 證書自動頒發（通常 1-5 分鐘）

### 方法 B：手動 DNS
如 `jkdcoding.com` 不在 Cloudflare，請手動新增 CNAME 記錄：
- **Name**: `cwmng`
- **Target**: `cwmng.pages.dev`

## 本地手動部署（無需 GitHub Actions）

在專案目錄下執行：

```bash
npx wrangler pages deploy . --project-name=cwmng --branch=main
```

或雙擊執行 `deploy.bat`。

## 部署後的網址

- Cloudflare Pages 預設網域：`https://cwmng.pages.dev`
- 自訂網域：`https://cwmng.jkdcoding.com`
