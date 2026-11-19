export function registrationWindowReason(details, now = Date.now()) {
  if (!details) return '';
  const end = Date.parse(details.registrationEndAtUtc);
  const start = Date.parse(details.registrationStartAtUtc);
  if (Number.isFinite(end) && now >= end) return '此課程已截止報名，請聯繫工作室。';
  if (Number.isFinite(start) && now < start) return '此課程尚未到報名開始時間。';
  return '';
}
