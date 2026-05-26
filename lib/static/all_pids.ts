/**
 * The full list of PIDs where Amaan is on the team (TL / Planner / Designer / PM).
 * Imported by index.ts (for scraping) and generate-brief.ts (for `--all-mine`).
 *
 * Update this list when a PID is added or removed from Amaan's portfolio.
 * Source of truth lives here so changes propagate to both scripts.
 *
 * Last refreshed: 2026-05-18 — diffed against the synced projects table
 * filtered to team_lead = 'Amaan Abdul Kader' and status != 'Cancelled'.
 * Cancelled PIDs (e.g. 28111, 29964) are intentionally excluded.
 */
export const ALL_AMAAN_PIDS: readonly number[] = [
  // 20 with existing export data
  24292, 28172, 33798, 19935, 20614, 24202, 24401,
  25210, 26903, 30646, 30969, 32125, 29662, 32245,
  33487, 31341, 23671, 28438, 28166, 29568,
  // 11 added 2026-05-11 — no historical export, scraper only
  // 28625 removed 2026-05-26 — Cancelled (Priyam & Manish)
  28698, 21491, 33797, 30731, 33673,
  33565, 31574, 33313, 33867, 34002,
  // 2 added 2026-05-18 — both Booked, both Sales WIP (no planner yet)
  30260, 34656,
] as const;

export const ALL_AMAAN_PIDS_STR: readonly string[] = ALL_AMAAN_PIDS.map(String);
