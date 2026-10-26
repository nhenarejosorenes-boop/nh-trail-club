export type ProgressSession = { id: string; session_date: string; category: string; title: string; completed: boolean };
export type TrailEntry = { id: string; activity_date: string; distance_km: number | string; elevation_m: number; duration_minutes: number; effort: number | null; feelings?: string };

export function athleteToday(at = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(at);
  return ["year", "month", "day"].map(type => parts.find(p => p.type === type)!.value).join("-");
}

export function monthRange(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Selecciona un mes válido.");
  const next = new Date(month + "-01T12:00:00Z");
  next.setUTCMonth(next.getUTCMonth() + 1);
  return { start: month + "-01", end: next.toISOString().slice(0, 10) };
}

function monday(date: string) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
  return d.toISOString().slice(0, 10);
}

export function trainingProgress(sessions: readonly ProgressSession[], entries: readonly TrailEntry[], month: string, today: string) {
  const { start, end } = monthRange(month);
  const planned = sessions.filter(s => s.session_date >= start && s.session_date < end);
  const runs = entries.filter(e => e.activity_date >= start && e.activity_date < end);
  const completed = planned.filter(s => s.completed).length;
  const efforts = runs.filter(e => e.effort !== null);
  const weeks = [];
  for (let date = monday(start); date < end;) {
    weeks.push({ start: date, km: 0, elevation: 0, minutes: 0, count: 0 });
    const next = new Date(date + "T12:00:00Z");
    next.setUTCDate(next.getUTCDate() + 7);
    date = next.toISOString().slice(0, 10);
  }
  const byWeek = new Map(weeks.map(w => [w.start, w]));
  for (const run of runs) {
    const bucket = byWeek.get(monday(run.activity_date));
    if (bucket) { bucket.km += Number(run.distance_km); bucket.elevation += run.elevation_m; bucket.minutes += run.duration_minutes; bucket.count++; }
  }
  return { planned: planned.length, completed,
    completion: planned.length ? Math.round(completed / planned.length * 100) : 0,
    overdue: planned.filter(s => !s.completed && s.session_date < today).length,
    upcoming: planned.filter(s => !s.completed && s.session_date >= today).length,
    km: runs.reduce((n, r) => n + Number(r.distance_km), 0),
    elevation: runs.reduce((n, r) => n + r.elevation_m, 0),
    minutes: runs.reduce((n, r) => n + r.duration_minutes, 0),
    runs: runs.length, missingEffort: runs.length - efforts.length,
    averageEffort: efforts.length ? efforts.reduce((n, r) => n + r.effort!, 0) / efforts.length : null,
    load: efforts.reduce((n, r) => n + r.duration_minutes * r.effort!, 0), weeks,
    categories: ["fuerza", "trail", "movilidad", "descanso"].map(category => ({ category,
      planned: planned.filter(s => s.category === category).length,
      completed: planned.filter(s => s.category === category && s.completed).length })),
  };
}
