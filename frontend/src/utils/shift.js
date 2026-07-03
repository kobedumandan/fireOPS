// Mirrors backend/shift_utils.py — 24h rotating A/B shifts with 08:00 Asia/Manila cutover.
const SHIFT_A_ANCHOR_UTC = Date.UTC(2026, 0, 1); // 2026-01-01 in UTC ms
const MS_PER_DAY = 86_400_000;

export function getCurrentShift(now = new Date()) {
  // Convert "now" to Asia/Manila wall-clock parts.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  const y = get("year");
  const m = get("month");
  const d = get("day");
  let hour = get("hour");
  if (hour === 24) hour = 0;

  let shiftDayUtc = Date.UTC(y, m - 1, d);
  if (hour < 8) shiftDayUtc -= MS_PER_DAY;

  const diffDays = Math.round((shiftDayUtc - SHIFT_A_ANCHOR_UTC) / MS_PER_DAY);
  const letter = diffDays % 2 === 0 ? "A" : "B";

  // Window covers shiftDay 08:00 → next day 08:00 in Manila.
  const startDate = new Date(shiftDayUtc);
  const endDate = new Date(shiftDayUtc + MS_PER_DAY);
  const startLabel = `${String(startDate.getUTCMonth() + 1).padStart(2, "0")}/${String(startDate.getUTCDate()).padStart(2, "0")} 08:00`;
  const endLabel = `${String(endDate.getUTCMonth() + 1).padStart(2, "0")}/${String(endDate.getUTCDate()).padStart(2, "0")} 08:00`;

  return { letter, window: `${startLabel} → ${endLabel}` };
}

// True when a "Shift A"/"Shift B" name matches the currently active shift.
// Records with no shift assigned ("—"/null) are not forced off-duty.
export function isOnCurrentShift(shiftName, now = new Date()) {
  if (!shiftName || shiftName === "—") return true;
  return shiftName === `Shift ${getCurrentShift(now).letter}`;
}
