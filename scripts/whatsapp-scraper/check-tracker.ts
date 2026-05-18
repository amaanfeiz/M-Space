import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const DEMO_PIDS = [24292, 28172, 33798];

async function main() {
  const { count, error: countErr } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true });
  if (countErr) throw countErr;

  const { data: latest } = await supabase
    .from('projects')
    .select('synced_at')
    .order('synced_at', { ascending: false })
    .limit(1);

  console.log(`Total rows in public.projects: ${count}`);
  console.log(`Most recent synced_at:         ${latest?.[0]?.synced_at ?? '(none)'}`);
  console.log('');
  console.log('Demo PID coverage in tracker:');

  for (const pid of DEMO_PIDS) {
    const { data, error } = await supabase
      .from('projects')
      .select(
        'pid, cx_name, cx_name_studio, team_lead, planner, designer, project_manager, event_start_date, event_end_date, venue, region, package_price_eff, bgmv, collection, collection_pct, overall_pid_risk, project_health, sentiment, synced_at',
      )
      .eq('pid', pid)
      .maybeSingle();

    if (error) {
      console.log(`  PID ${pid}: ERROR — ${error.message}`);
      continue;
    }
    if (!data) {
      console.log(`  PID ${pid}: NOT FOUND in projects table`);
      continue;
    }
    console.log(`  PID ${pid}: ${data.cx_name ?? '(no couple name)'}`);
    console.log(`    TL=${data.team_lead ?? '-'}  Planner=${data.planner ?? '-'}  Designer=${data.designer ?? '-'}  PM=${data.project_manager ?? '-'}`);
    console.log(`    Venue=${data.venue ?? '-'}  Region=${data.region ?? '-'}  Dates=${data.event_start_date ?? '?'} → ${data.event_end_date ?? '?'}`);
    console.log(`    Package SP=${data.package_price_eff ?? '?'}  GMV=${data.bgmv ?? '?'}  Collection=${data.collection ?? '?'} (${data.collection_pct ?? '?'}%)`);
    console.log(`    Risk=${data.overall_pid_risk ?? '-'}  Health=${data.project_health ?? '-'}  Sentiment=${data.sentiment ?? '-'}`);
    console.log(`    Synced=${data.synced_at}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
