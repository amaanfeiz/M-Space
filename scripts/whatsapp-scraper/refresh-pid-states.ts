import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  const { data, error } = await supabase.rpc('refresh_pid_states');
  if (error) {
    console.error('refresh_pid_states failed:', error.message);
    process.exit(1);
  }
  console.log(`Refreshed ${data} PIDs`);
}

main().catch((err) => { console.error(err); process.exit(1); });
