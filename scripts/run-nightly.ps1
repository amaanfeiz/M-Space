# Meragi Intel — nightly analysis pipeline
# Triggered by Windows Task Scheduler at laptop-awake time.
# Sequence: scrape → enrich → resolve → lexical → refresh state → T1 → T1b → T2.5 → T3
# Each step must exit 0 for the next to run (except T1b which is non-blocking).

$SCRIPTS = "C:\Users\Amaan\Projects\meragi-intel\scripts\whatsapp-scraper"
$LOG     = "C:\Users\Amaan\Projects\meragi-intel\logs\nightly-$(Get-Date -Format 'yyyy-MM-dd').log"

# Ensure log directory exists
New-Item -ItemType Directory -Force -Path (Split-Path $LOG) | Out-Null

function Log($msg) {
    $ts = Get-Date -Format 'HH:mm:ss'
    $line = "[$ts] $msg"
    Write-Host $line
    Add-Content -Path $LOG -Value $line
}

function Run($label, $script, $args = @()) {
    Log "START $label"
    $start = Get-Date
    & npx tsx "$SCRIPTS\$script" @args
    $exit = $LASTEXITCODE
    $secs = [int]((Get-Date) - $start).TotalSeconds
    if ($exit -ne 0) {
        Log "FAIL  $label (exit $exit, ${secs}s)"
        return $false
    }
    Log "OK    $label (${secs}s)"
    return $true
}

Log "=== Nightly pipeline starting ==="

# 1 — Scrape WhatsApp messages
if (-not (Run "scrape" "index.ts")) { Log "Pipeline aborted at scrape."; exit 1 }

# 2 — Enrich contacts (WhatsApp saved names / pushnames)
if (-not (Run "enrich-contacts" "enrich-contacts.ts")) { Log "Enrich failed — continuing."; }

# 3 — Resolve sender identities
if (-not (Run "resolve-senders" "resolve-senders.ts")) { Log "Resolve failed — continuing."; }

# 4 — Lexical flag pre-pass (WS14/15/41/42/43/50)
if (-not (Run "lexical-flags" "lexical-flags.ts")) { Log "Lexical failed — continuing."; }

# 5 — Refresh pid_state (phase, runway, recovery)
if (-not (Run "refresh-pid-states" "refresh-pid-states.ts")) { Log "Refresh pid states failed — continuing."; }

# 6 — T1: per-PID Haiku briefs
if (-not (Run "T1-briefs" "generate-brief.ts" @("--all-mine"))) { Log "Pipeline aborted at T1."; exit 1 }

# 7 — T1b: implicit feedback match (non-blocking)
if (-not (Run "T1b-feedback" "t1b-feedback-match.ts")) { Log "T1b failed — continuing."; }

# 8 — T2.5: SOP critic (Sonnet)
if (-not (Run "T2.5-critic" "t2-5-sop-critic.ts")) { Log "T2.5 failed — continuing."; }

# 9 — T3: Opus portfolio brief
if (-not (Run "T3-portfolio" "t3-portfolio-brief.ts")) { Log "T3 failed."; exit 1 }

Log "=== Nightly pipeline complete ==="
