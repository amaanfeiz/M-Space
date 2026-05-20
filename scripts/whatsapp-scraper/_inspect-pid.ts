import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const PID = parseInt(process.argv[2] ?? '0', 10);
const DATE = process.argv[3] ?? new Date().toISOString().slice(0, 10);

async function main() {
  const { data: project } = await supabase
    .from('projects')
    .select(
      'pid, cx_name, status, planning_status, t_days, collection_pct, project_health, cancellation_risk, cancellation_risk_reason, sentiment, overall_pid_risk, overall_risk_summary, current_summary, ai_notes_summary, team_lead, planner',
    )
    .eq('pid', PID)
    .single();

  console.log('--- TRACKER ROW ---');
  console.log(JSON.stringify(project, null, 2));

  const { data: brief } = await supabase
    .from('briefs')
    .select('brief_json, is_catchup')
    .eq('pid', PID)
    .eq('brief_date', DATE)
    .single();

  console.log(`\n--- BRIEF JSON (${DATE}) ---`);
  console.log(JSON.stringify(brief, null, 2));

  const { data: flags } = await supabase
    .from('sop_flags')
    .select('flag, severity, detail')
    .eq('pid', PID);

  console.log('\n--- SOP FLAGS ---');
  console.log(JSON.stringify(flags, null, 2));

  const { count } = await supabase
    .from('signals')
    .select('*', { count: 'exact', head: true })
    .eq('pid', PID);

  console.log(`\n--- SIGNALS COUNT ---`);
  console.log(`Total signals for PID ${PID}: ${count}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
