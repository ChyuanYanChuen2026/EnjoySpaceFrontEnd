export const date = (v) => new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "long", day: "numeric", weekday: "short" }).format(new Date(v));
export const time = (v) => new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(v));
export const money = (v) => new Intl.NumberFormat("zh-TW", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
export const validity = (plan) => plan.validityText || (plan.validityUnit === "Unlimited" ? "不限期" : plan.validityUnit === "Days" ? `${plan.validityValue} 天（含生效日）` : plan.validityUnit === "Months" ? `${plan.validityValue} 個月` : plan.validityUnit === "Session" ? "依堂次使用" : "請洽工作室確認效期");
export const audience = (plan) => plan.audienceText || { TrialGuest: "體驗生", Student: "正式學生" }[plan.audienceType] || plan.audienceType;
export const calendarDate = (v) => (v ? v.slice(0, 10).replaceAll("-", "/") : "尚未設定");
