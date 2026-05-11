export function formatMinutesTotal(totalMinutes?: number | null) {
  const safe = Math.max(0, Math.round(Number(totalMinutes ?? 0)));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;

  if (hours <= 0) return `${minutes} min`;
  if (minutes <= 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

export function formatDailyFromWeekly(totalWeekMinutes?: number | null) {
  const daily = Number(totalWeekMinutes ?? 0) / 7;
  return formatMinutesTotal(daily);
}
