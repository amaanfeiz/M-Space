# Meragi Intel — nightly analysis pipeline
# Triggered by Windows Task Scheduler at 22:00 IST.
# Sequence: scrape → T1 briefs → T1b feedback match → T3 portfolio brief
# Each step must exit 0 for the next to run.

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

# 1 — Scrape
if (-not (Run "scrape" "index.ts")) { Log "Pipeline aborted at scrape."; exit 1 }

# 2 — T1: per-PID Haiku briefs
if (-not (Run "T1-briefs" "generate-brief.ts" @("--all-mine"))) { Log "Pipeline aborted at T1."; exit 1 }

# 3 — T1b: implicit feedback match
if (-not (Run "T1b-feedback" "t1b-feedback-match.ts")) { Log "T1b failed — continuing."; }

# 4 — T3: Opus portfolio brief
if (-not (Run "T3-portfolio" "t3-portfolio-brief.ts")) { Log "T3 failed."; exit 1 }

Log "=== Nightly pipeline complete ==="
