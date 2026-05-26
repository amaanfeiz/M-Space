const IST_TZ = 'Asia/Kolkata';

export function todayIstYmd(): string {
  return istYmdFromDate(new Date());
}

export function istYmdFromDate(d: Date): string {
  return d.toLocaleDateString('sv-SE', { timeZone: IST_TZ });
}

export function briefDateCutoff(briefDate: string, days: number): string {
  const d = new Date(briefDate + 'T00:00:00+05:30');
  d.setDate(d.getDate() - days);
  return d.toISOString();
}
