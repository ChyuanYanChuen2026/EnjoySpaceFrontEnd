# Enjoy Space 官網

獨立 Vue 3 + JavaScript + Vite 專案。MVC 管理介面維持在 `EnjoySpace.Web`，官網以 `/api/portal` 讀寫同一個 `AppDbContext`，不另建課程資料庫。

## 本機啟動

1. 在 MVC 專案確認既有 `DefaultConnection` 設定。
2. 確認後台資料庫已有目前版本需要的結構。資料庫更新須先檢查完整 migration 與目標連線；不要為了啟動前台，直接對本機或正式資料庫執行更新。
3. 在 MVC 專案執行 `dotnet run --launch-profile http`（`http://localhost:5209`）。
4. 在本目錄執行 `npm ci`、`npm run dev`，開啟 `http://127.0.0.1:4000`。套件已完整安裝時，後續只需 `npm run dev`。

Vite 將 `/api` 代理至 MVC，瀏覽器使用同源 Cookie；本機請以同一個官網網址操作登入與送出表單。所有前台 API 請求統一透過 `src/api.js` 的 Axios 實例，保留 Cookie、防偽 token、JSON 驗證與錯誤提示，連線逾時為 15 秒。

後台連接埠不同時，複製 `.env.example` 為 `.env.local`，設定 `API_PROXY_TARGET` 後重啟 Vite。`npm run preview` 也會使用相同代理設定。

## 建置與部署

執行 `npm run build`，產出 `dist/`。部署靜態網站時，前端路由 fallback 設為 `index.html`；`/api/portal/*` 必須代理至 MVC 並保留 Cookie、Set-Cookie 與防偽 header。正式環境使用 HTTPS，代理應轉送正確的 scheme。API 與靜態檔案可分開部署，但在瀏覽器使用同源入口；目前不採跨站 Cookie 或任意來源 CORS。

### Cloudflare 正式部署與 main 自動更新

目前採用 **Workers + Static Assets**，不是 Pages。`vite.config.js` 只在 `--mode cloudflare` 載入 Cloudflare 外掛；本機 `npm run dev` 繼續使用 Vite `/api` 代理。

| 項目 | 設定 |
| --- | --- |
| Git 儲存庫 | `ChyuanYanChuen2026/EnjoySpaceFrontEnd` |
| Worker 名稱 | `enjoyspacefrontend`，須與 `wrangler.jsonc` 的 `name` 完全一致 |
| 正式分支 | `main`，注意大小寫；`Dev` 不直接發布正式環境 |
| Root directory | `/`（這是獨立的前台儲存庫） |
| Build command | `npm test && npm run build:cloudflare` |
| Deploy command | `npx wrangler deploy` |
| 前台主網址 | `https://twtpenjoyspace.com` |
| API_ORIGIN | `https://app-enjoyspace-prod-heeghtdcbte9hyd8.eastasia-01.azurewebsites.net` |

`API_ORIGIN` 是公開的後台網址，可存版本控制；密碼、連線字串、Cloudflare API Token 都不能放在前台或 `VITE_*` 變數。這個網址在 `wrangler.jsonc` 管理，日後更新後台網址要同步修改此檔，避免 Dashboard 的手動值被下次部署覆蓋。測試環境如需使用不同後台，先另外規劃環境設定，不要讓測試送出操作寫入正式資料。

依序設定，每一步確認成功後才繼續：

1. 本機執行 `npm test`、`npm run build`、`npm run check:cloudflare`；最後一個只有打包與部署 dry-run，不會發布。確認這輪變更與測試檔都已納入 Git；`dist/`、`dist-cloudflare/`、`.wrangler/` 不應提交。
2. 將已驗證版本正常合併到 `main` 並推送；不要使用 force push。若合併有衝突，先核對差異。舊 `main` 曾追蹤建置產物，須在合併時取消它們的 Git 追蹤，保留原始碼、lockfile 與本機檔案。
3. Cloudflare → Workers & Pages → `enjoyspacefrontend` → Settings → Builds，連接上表儲存庫，設定 Production branch 為 `main`、Root directory 與建置／部署命令。保持自動建置啟用；沒有測試環境時先停用非正式分支建置。
4. 在 Deployments 查看**新的**建置，核對分支及 commit SHA 與剛推送的 `main` 相同。重試舊失敗建置可能仍使用舊 commit，不能當作最新發布。
5. 先測試 `workers.dev` 網址及 `/api/portal/catalog`。後者應為 JSON，不可回 Vue 的 HTML 或 503。空陣列表示尚無公開課程，不能靠新增假資料解決。
6. 同一 Worker → Settings → Domains & Routes → Add → Custom Domain，輸入 `twtpenjoyspace.com`。部分介面另列 Domains 分頁。Cloudflare 會建立對應 DNS／TLS 憑證；有既存網站 DNS 衝突時先核對，勿刪除不相關的 MX、TXT 或其他網站紀錄。等狀態為 Active 後再開啟 HTTPS 網址。
7. 本專案目前讓 Custom Domain 由 Dashboard 管理，`wrangler.jsonc` **不宣告 routes**。不要為了綁網域新增萬用 `/*` 代理或重建 Worker。後續要改由程式管理網域時，先完整列出現有綁定再遷移。`www.twtpenjoyspace.com` 尚未設定，不視為自動可用。
8. Azure 後台將 `Portal__PublicBaseUrl` 設為 `https://twtpenjoyspace.com`，確保新產生的課堂 QR Code 指向新網域。密碼重設後台網址另依既有 `PasswordRecovery__PublicBaseUrl` 流程設定，不混用。確認 Production、HTTPS／代理辨識與 Cookie 設定，再測登入與資料送出。
9. 日後 `main` 每次收到新的 push，Workers Builds 應自動執行測試、建置與部署。以 commit SHA 核對一次完整自動更新；失敗時查看新建置紀錄，原有成功部署仍是目前版本。需要回復時使用已驗證的上一版部署，並同步修正 `main`。

綁新網域後，舊網域的登入 Cookie 不會搬過去，會員需要重新登入。先保留舊 Worker 網址供排錯，不在未驗證時刪除。

官方操作依據：[Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/)、[正式分支](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/)、[Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)。

## 前台安全設計

### XSS 與輸出

- 現有頁面以 Vue `{{ }}` 插值輸出課名、姓名、備註及錯誤訊息，沒有 `v-html`、`innerHTML`、`eval` 或以使用者輸入建立模板。
- 保持純文字輸出；目前不需要引入 HTML sanitizer。若未來需要富文字，須選用持續維護的 sanitizer、限制允許標籤與屬性，並同步處理後端輸出，不能只用正規表示式移除 `<script>`。
- Google 地圖網址的網域固定為 `https://www.google.com`，地址經 `encodeURIComponent`；外開連結使用 `noopener noreferrer`。登入返回網址只接受已知站內頁面，不接受外站、反斜線或控制字元。
- 登入憑證使用既有 HttpOnly Cookie，不寫入 localStorage。打卡流程會在 sessionStorage 暫存課堂 QR 代碼及場次 ID，以銜接登入；它不是登入憑證，後端仍檢查會員、有效名單、期限及人工更正狀態。

### CSP（Content Security Policy）

正式靜態資源由 `public/_headers` 設定 **Content-Security-Policy** 回應標頭，Vite 建置會複製此檔到資產目錄。政策是強制執行，不是只有 Report-Only；HTTP 標頭會保護直接進入 `/member/...` 等 SPA 路徑。

```text
default-src 'self';
script-src 'self';
script-src-attr 'none';
style-src 'self' https://fonts.googleapis.com;
style-src-attr 'none';
font-src 'self' https://fonts.gstatic.com;
img-src 'self';
connect-src 'self';
frame-src https://www.google.com;
object-src 'none';
base-uri 'none';
form-action 'self';
frame-ancestors 'none'
```

| 來源／限制 | 原因 |
| --- | --- |
| script、img、connect 限 `self` | JS／圖片為本站資產，Axios 只呼叫本站 `/api/portal`；不讓瀏覽器直接連 Azure 或任意外站 |
| Google Fonts 的 CSS 與字型網域 | 現有 Noto 字型需要；沒有放行整個 `https:` 或萬用 Google 網域 |
| frame 僅允許 `www.google.com` | 保留教室地圖 iframe；其內部資源由 Google 自身政策處理 |
| `object/base/frame-ancestors` 為 `none` | 禁止外掛、變更基底網址與外站嵌入本站 |
| 不允許 `unsafe-inline`、`unsafe-eval` | 正式 Vue 元件已編譯、CSS 外置，不需放寬腳本政策 |

Cloudflare `_headers` **不會替 Worker 產生的 API 回應加標頭**，因此 `worker/index.js` 另設 `default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`。代理只接受 JSON／`application/*+json`（以及無內容 204／HEAD）；HTML 成功頁改成中文 502 JSON，HTML／空白 4xx 則保留狀態碼並替換為固定中文 JSON，讓過期防偽 Token 可正常清除。

靜態與 API 回應也有 `nosniff`、`X-Frame-Options: DENY`、`strict-origin-when-cross-origin` 及 180 天 HSTS；HSTS 沒有 `includeSubDomains` 或 `preload`，避免未就緒子網域被一起鎖定。相機／麥克風／定位的頁面權限預設關閉；目前掃碼使用手機相機 App 開啟網址，網站本身不讀相機。

本機 `npm run dev` 的 HMR 會注入開發程式與樣式，不能以開發伺服器取代正式 CSP 驗證。必須用 Cloudflare 建置預覽與最後的正式網址確認標頭、瀏覽器 Console、Google 地圖與字型。若 Dashboard 啟用了 Rocket Loader、Zaraz 或自動注入 Web Analytics，先停用不必要項目或逐項評估其來源，不為了消除警告加入 `unsafe-inline`／`*`。目前沒有 CSP 回報收集端點，瀏覽器 Console 是檢查依據。

參考：[Vue 安全說明](https://vuejs.org/guide/best-practices/security.html)、[Cloudflare 靜態標頭](https://developers.cloudflare.com/workers/static-assets/headers/)、[MDN CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy)。

### API 錯誤處理

- Axios 15 秒逾時；Worker 等待上游回應標頭最多 12 秒。斷線、逾時、格式錯誤及 401／403／404／409／429 分別顯示中文提示；5xx 不顯示後端原始 message／detail、堆疊或連線資訊。
- 所有欄位錯誤經 `validationErrors.js` 整理。只接受簡短中文業務訊息，其他內容改為中文通用提示；畫面仍以 Vue 純文字插值輸出。
- 先取得並檢查 CSRF token，併發共用取 token 請求；登入／登出或 400／401／403 後清除舊 token。400 不一定是 CSRF 失效，所以不誤稱所有表單錯誤都是過期。
- POST 失敗**不自動重送**。逾時或 5xx 不代表寫入失敗，提醒先查詢紀錄，避免重複申請／扣堂；保留打卡 `code` 與 `sessionId` 的處理流程。
- 會員狀態只有在 401 時清除；網路或服務錯誤保留上次已知會員，顯示重新確認提示。這不授予操作權限，每次實際寫入仍由後端驗證。
- API 不快取、不追隨後台轉址；保留多筆 Set-Cookie，移除伺服器版本標頭。不信任瀏覽器傳入的 Forwarded／X-Forwarded-*。Azure HTTPS、代理信任及依來源 IP 限流仍需正式環境另行驗證，前台檢查不代表後端完整資安稽核已完成。

### 輸入驗證與驗收

- Vue 表單使用局部 `v-chinese-validation` 指令，沒有全域點擊／表單攔截；必填、長度、Email、密碼確認與日期錯誤顯示繁中。
- 註冊與體驗手機都必須是 `09` 開頭、共 10 碼 ASCII 數字。不接受空格、連字號、括號、國際格式或全形數字，也不先 trim／去除符號。
- 課表查詢驗證日期合法性、起訖順序與含起訖最多 93 天；體驗預約檢查場次有效選項、重複選擇、是否已開課與剩餘額度。前端提示只改善操作體驗，後端在實際送出時仍是資格／名額／金額與本人身分的最終檢核。
- `npm test` 以隔離 Axios adapter／Worker mock 驗證錯誤、Token、輸入與代理邊界，不連正式資料庫、不建立測試會員。`npm run build` 與 `npm run check:cloudflare` 分別檢查一般與 Cloudflare 正式產物。
- 正式發布後仍須驗收首頁、深層路由重新整理、註冊與登入、手機錯誤、體驗送出與重複阻擋、過期登入、逾時與 CSP。涉及帳號／報名的寫入應用事先約定的測試帳號和課程執行，不把 build 成功當成正式業務流程驗收通過。

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

課程頁顯示後台的學期起迄、整期金額、正常堂數、預設老師／教室／容量及彈性預約／補課設定。場次頁採該場次實際老師、教室與容量覆寫值；額外加開不計入整期正常堂數。`/plans` 列出所有啟用方案，金額畫面顯示整數，使用對象及效期文字與 MVC 共用定義。

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
