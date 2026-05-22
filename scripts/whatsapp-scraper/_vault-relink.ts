/**
 * One-off vault relinker.
 *
 * Walks every existing brief markdown file in the Obsidian vault and rewrites
 * plain-text team member names + PID numbers into [[wikilinks]] so the graph
 * view shows the people <-> PID cluster instead of disconnected stars.
 *
 * Run once after a vault cleanup, or after generate-brief.ts is updated to
 * emit wikilinks natively (then this becomes a no-op for new briefs).
 *
 * Usage: npx tsx _vault-relink.ts
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';

const VAULT = 'C:\\Users\\Amaan\\Obsidian\\Meragi-Intel';
const PIDS_DIR = join(VAULT, 'pids');

// Known team roster — matches people/*.md note names exactly.
const TEAM_ROSTER = [
  'Amaan Abdul Kader',
  'Bhavika Gurnani',
  'Shreyanshu Tiwari',
  'Varun Mittal',
  'Tapasya Waldia',
  'Somila Bhadauriya',
  'Nikhil Gupta',
  'Aditya Sharma',
  'Jaishree Patel',
  'Narendra Singh',
  'Ananth Santhosh',
];

// First-name -> full-name map for "Tapasya (Planner)" style mentions.
const FIRST_NAME_MAP: Record<string, string> = {};
for (const full of TEAM_ROSTER) {
  const first = full.split(' ')[0];
  FIRST_NAME_MAP[first] = full;
}

function linkifyTeamNames(text: string): string {
  let result = text;
  // Pass 1: replace full names with wikilinks (must come before first-name pass)
  for (const full of TEAM_ROSTER) {
    // Skip if already linked
    const escapedFull = full.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?<!\\[\\[)\\b${escapedFull}\\b(?!\\]\\])`, 'g');
    result = result.replace(re, `[[${full}]]`);
  }
  // Pass 2: replace first names followed by role parenthetical
  // e.g. "Tapasya (Planner)" -> "[[Tapasya Waldia]] (Planner)"
  for (const [first, full] of Object.entries(FIRST_NAME_MAP)) {
    const re = new RegExp(
      `(?<!\\[\\[)\\b${first}\\b(?=\\s*\\((?:planner|designer|project_manager|pm|tl|team_lead|rm)\\))`,
      'gi',
    );
    result = result.replace(re, `[[${full}]]`);
  }
  return result;
}

function appendRelatedSection(content: string, pid: string): string {
  if (content.includes('## Related')) return content;
  const related = [
    '',
    '---',
    '',
    '## Related',
    '',
    `- PID hub: [[pids/${pid}]]`,
    '- [[00 - Map of Content]]',
    '- [[people/00-index]]',
    '',
  ].join('\n');
  return content.trimEnd() + '\n' + related + '\n';
}

function walkBriefs(): Array<{ path: string; pid: string }> {
  const out: Array<{ path: string; pid: string }> = [];
  for (const entry of readdirSync(PIDS_DIR)) {
    const entryPath = join(PIDS_DIR, entry);
    const stat = statSync(entryPath);
    if (stat.isFile() && entry.endsWith('.md')) {
      const pid = entry.replace('.md', '');
      out.push({ path: entryPath, pid });
    } else if (stat.isDirectory()) {
      const briefsDir = join(entryPath, 'briefs');
      try {
        for (const brief of readdirSync(briefsDir)) {
          if (brief.endsWith('.md')) {
            out.push({ path: join(briefsDir, brief), pid: entry });
          }
        }
      } catch { /* no briefs dir */ }
    }
  }
  return out;
}

function main() {
  const files = walkBriefs();
  let touched = 0;
  let unchanged = 0;
  for (const f of files) {
    const original = readFileSync(f.path, 'utf-8');
    let updated = linkifyTeamNames(original);
    updated = appendRelatedSection(updated, f.pid);
    if (updated !== original) {
      writeFileSync(f.path, updated, 'utf-8');
      touched += 1;
    } else {
      unchanged += 1;
    }
  }
  console.log(`Rewrote ${touched} / ${files.length} files. ${unchanged} unchanged.`);
}

main();
