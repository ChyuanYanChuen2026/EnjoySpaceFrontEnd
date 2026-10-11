# Enjoy Space 官網

獨立 Vue 3 + JavaScript + Vite 專案。MVC 管理介面維持在 `EnjoySpace.Web`，官網以 `/api/portal` 讀寫同一個 `AppDbContext`，不另建課程資料庫。

## 本機啟動

1. 在 MVC 專案確認既有 `DefaultConnection` 設定。
2. 使用 EF 工具套用 `AddPortalTrialRequests` migration。此 migration 新增官網申請表及 `TrialGuest` 角色；部署前請依既有資料庫升級程序備份與檢查 migration。
3. 在 MVC 專案執行 `dotnet run --launch-profile http`（`http://localhost:5209`）。
4. 在本目錄執行 `npm ci`、`npm run dev`，開啟 `http://127.0.0.1:5173`。

Vite 將 `/api` 代理至 MVC，瀏覽器使用同源 Cookie；本機請以同一個官網網址操作登入與送出表單。

## 建置與部署

執行 `npm run build`，產出 `dist/`。部署靜態網站時，前端路由 fallback 設為 `index.html`；`/api/portal/*` 必須代理至 MVC 並保留 Cookie、Set-Cookie 與防偽 header。正式環境使用 HTTPS，代理應轉送正確的 scheme。API 與靜態檔案可分開部署，但在瀏覽器使用同源入口；目前不採跨站 Cookie 或任意來源 CORS。

## 帳號與資料

- 學生、老師沿用後台 `Users`、`UserRoles` 與既有密碼雜湊。需要有效 `Student` 或 `Teacher` 角色。
- 註冊只建立 `TrialGuest` 身分，不能自行取得老師、學生或 Admin 權限。
- 官網使用 `EnjoySpace.Portal` Cookie，管理員使用原本 MVC Cookie。包含 Admin 角色的帳號不能登入官網。
- 課程僅公開啟用、允許公開且學期為 Open / Closed 的資料；草稿學期不公開。
- 課表人數來自有效的 `ClassSessionParticipants`；未核准的體驗申請不佔名額。
- 官網體驗申請存入 `PortalTrialRequests` 與 `TrialGuests`，後台 `/Admin/PortalTrials` 可檢視並標記已聯繫／取消。
- 會員專區提供個人課程／授課行程與體驗申請。收款與正式排課仍由既有後台流程處理。
- 不使用示意假資料。資料未開放或 API 離線時顯示空狀態／錯誤提示。
- 照片為生成的品牌情境示意，非實際教師照片。

## API

GET：`csrf`、`catalog`、`sessions`、`me`、`dashboard`。

POST：`login`、`register`、`logout`、`trial-requests`。所有寫入需先取得 `csrf` 的 token，透過 `X-CSRF-TOKEN` 送出。登入與登出後需重新取得 token。

前端原始碼皆使用 `.js` 與 Vue `<script setup>`，沒有 TypeScript 建置步驟。
