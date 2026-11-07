# Enjoy Space 官網

獨立 Vue 3 + JavaScript + Vite 專案。MVC 管理介面維持在 `EnjoySpace.Web`，官網以 `/api/portal` 讀寫同一個 `AppDbContext`，不另建課程資料庫。

## 本機啟動

1. 在 MVC 專案確認既有 `DefaultConnection` 設定。
2. 使用 EF 工具套用 `AddPortalTrialRequests` migration。此 migration 新增官網申請表及 `TrialGuest` 角色；部署前請依既有資料庫升級程序備份與檢查 migration。
3. 在 MVC 專案執行 `dotnet run --launch-profile http`（`http://localhost:5209`）。
4. 在本目錄執行 `npm ci`、`npm run dev`，開啟 `http://127.0.0.1:4000`。套件已完整安裝時，後續只需 `npm run dev`。

Vite 將 `/api` 代理至 MVC，瀏覽器使用同源 Cookie；本機請以同一個官網網址操作登入與送出表單。所有前台 API 請求統一透過 `src/api.js` 的 Axios 實例，保留 Cookie、防偽 token、JSON 驗證與錯誤提示，連線逾時為 15 秒。

後台連接埠不同時，複製 `.env.example` 為 `.env.local`，設定 `API_PROXY_TARGET` 後重啟 Vite。例如獨立 Demo 使用 `http://localhost:5210`。`npm run preview` 也會使用相同代理設定。

## 建置與部署

執行 `npm run build`，產出 `dist/`。部署靜態網站時，前端路由 fallback 設為 `index.html`；`/api/portal/*` 必須代理至 MVC 並保留 Cookie、Set-Cookie 與防偽 header。正式環境使用 HTTPS，代理應轉送正確的 scheme。API 與靜態檔案可分開部署，但在瀏覽器使用同源入口；目前不採跨站 Cookie 或任意來源 CORS。

## 帳號與資料

- 學生、老師沿用後台 `Users`、`UserRoles` 與既有密碼雜湊。需要有效 `Student` 或 `Teacher` 角色。
- 註冊建立 `Student` 角色與啟用的 `Students` 資料，不建立體驗生、不報名正式課程，也不能自行取得老師或 Admin 權限。學生送出體驗申請時才建立 `TrialGuests` 紀錄，帳號保留學生角色。舊有體驗生帳號仍可登入及申請，不會依姓名、電話或 Email 自動合併身分。
- 官網使用 `EnjoySpace.Portal` Cookie，管理員使用原本 MVC Cookie。包含 Admin 角色的帳號不能登入官網。
- 課程僅公開啟用、允許公開且學期為 Open / Closed 的資料；草稿學期不公開。
- 課表人數與後台出席名單一致：`ClassSessionParticipants.Status` 與其 `CourseEnrollment.Status` 都須為 `Active`；未核准的體驗申請不佔名額。
- 官網體驗申請存入 `PortalTrialRequests` 與 `TrialGuests`，後台 `/Admin/PortalTrials` 可檢視並標記已聯繫／取消。
- 體驗申請須登入學生或既有體驗生帳號，選擇啟用的 `PlanType=Trial`、`AudienceType=TrialGuest` 方案及未額滿的未來公開場次。方案由後台「課程方案」建立；沒有方案時前台會說明原因並暫停送出，不會自動建立免費或未定價方案。後台啟用方案後，前台重新取得資料即可選擇及送出。
- 會員專區提供個人課程／授課行程、體驗申請及購買方案／付款狀態。購買金額、堂數與名稱採購買當時快照；收款與正式排課仍由既有後台流程處理。
- 不使用示意假資料。資料未開放或 API 離線時顯示空狀態／錯誤提示。
- 照片為生成的品牌情境示意，非實際教師照片。

## API

GET：`csrf`、`catalog`、`courses/{id}`、`sessions`、`me`、`dashboard`。

`catalog` 提供公開課程、學期、啟用方案及教室；`courses/{id}` 提供課程明細與全部未來公開場次；`sessions` 可依 `from`、`until`（最多 93 天）、`courseId`、`termId` 篩選，或以 `sessionId` 查詢單一未來場次。未指定日期時查詢未來 60 天。

課程頁顯示後台的學期起迄、整期金額、正常堂數、預設老師／教室／容量及彈性預約／補課設定。場次頁採該場次實際老師、教室與容量覆寫值；額外加開不計入整期正常堂數。`/plans` 列出所有啟用方案，金額保留兩位小數，使用對象及效期文字與 MVC 共用定義。

切換頁面、回到瀏覽器視窗或按「更新資料」都會重新取得資料，頁首顯示上次成功更新時間。這是重新查詢 API，並非背景即時推播。停用、不公開、草稿學期與無效老師／教室的課程不對訪客展示。

體驗申請新增介紹人功能需套用 `AddPortalTrialReferrals`；月份效期需套用 `SupportMonthlyLessonPlans`。這兩個 migration 新增方案條件、申請介紹人欄位及月份效期約束，不刪除既有資料。

體驗方案：舊生介紹一堂免費須填寫介紹人，送出資料後仍須直接聯繫管理員核對、登記安排；三堂體驗為 NT$1,000、兩個日曆月，先選一個希望上的場次，其餘由後台聯繫安排。兩者均只建立待處理申請，不自動收款或加入出席名單。介紹人為申請人填寫的姓名，不直接授予資格或自動連結學生；管理員在「官網體驗申請」核對後，再至「體驗生」設定正式介紹學生。

月份效期以管理員購買登記時指定的生效日計算，至加上月份後的對應日前一天（含當天），例如 10/16 生效的兩個月方案至 12/15。申請日不會直接起算效期。

老師的 `Teacher.IsActive` 決定是否可公開授課，`User.IsActive` 決定能否登入。匯入的老師可能尚未開通登入，但啟用中的老師所屬公開課程仍應顯示，與後台選擇老師的規則一致。

POST：`login`、`register`、`logout`、`trial-requests`。所有寫入需先取得 `csrf` 的 token，透過 `X-CSRF-TOKEN` 送出。登入與登出後需重新取得 token。

前端原始碼皆使用 `.js` 與 Vue `<script setup lang="js">`，沒有 TypeScript 建置步驟。`defineProps({ title: String })` 等寫法是 Vue 的 JavaScript 執行期屬性定義，並非 TypeScript 型別註記。第三方套件附帶的 `.d.ts` 是套件提供的型別資訊，不屬於本專案原始碼，不需刪除。

## 檢查

`npm test` 驗證 API 錯誤與防偽 token 處理；`npm run build` 驗證 Vue 元件與正式打包。後台流程測試請在 MVC 專案執行 `dotnet run --project Tests/WorkflowChecks --configuration Rules --no-restore -- --http`，使用並清除獨立測試資料庫。

若出現找不到 Vite，先停止此官網的開發伺服器，再執行 `npm ci`。Windows 執行中的 Vite 可能鎖住 Rollup 原生套件，造成重新安裝失敗。

體驗申請登入前的草稿僅保留在記憶體，返回登入頁再回到體驗頁時可保留；重新整理或關閉分頁會清除。此設計不把姓名、電話、Email 寫入瀏覽器持久儲存。
