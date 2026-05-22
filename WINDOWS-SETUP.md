# Windows Setup Runbook — Meragi Intel

> Everything you need to do **before** starting Claude Code. Aim for ~60-90 minutes the first time. If anything below fails, paste the exact error message back to your Opus chat — don't try to debug alone.

## What you're installing and why

| Tool | What it is | Why |
|---|---|---|
| Node.js | A program that runs JavaScript on your computer | Claude Code is built on it; Next.js (the dashboard framework) needs it |
| Git | Version control | Talks to GitHub; tracks your code changes |
| Claude Code | Anthropic's terminal-based coding assistant | The agent that builds the dashboard |
| pnpm | A package manager (alternative to npm) | Faster, less disk space; we use it for this project |

You won't directly use any of these by typing complex commands — Claude Code drives most of it. But they need to be installed.

---

## Step 1 — Install Node.js (15 min)

1. Go to https://nodejs.org
2. Click the **big green LTS button** (left one, not the right one). Currently version 20.x.
3. Run the downloaded `.msi` installer.
4. Click **Next** through everything. Accept defaults. The "Tools for Native Modules" checkbox at the end — leave it unchecked, you don't need it.
5. **Restart your computer.** This sounds excessive but the PATH variable takes effect cleanly only after restart on Windows.
6. After restart, open **PowerShell** (Start menu → type "powershell" → Enter).
7. Type and press Enter:
   ```
   node --version
   ```
   You should see `v20.x.y`. If you see "command not found" or similar, the install didn't take — re-run the installer and restart again.
8. Also test:
   ```
   npm --version
   ```
   Should show something like `10.x.x`.

## Step 2 — Install pnpm (2 min)

In PowerShell:
```
npm install -g pnpm
```

Verify:
```
pnpm --version
```
Should show `9.x.x` or higher.

## Step 3 — Install Git (10 min)

1. Go to https://git-scm.com/download/win
2. Download starts automatically. Run the installer.
3. Click **Next** through everything **except**:
   - "Choosing the default editor used by Git" — pick **Visual Studio Code** if it's listed (we'll install it next), or leave the default.
   - Everything else: defaults are correct.
4. Verify in a **new** PowerShell window (close the old one first so it picks up Git):
   ```
   git --version
   ```
   Should show `git version 2.x.y`.

## Step 4 — Install VS Code (10 min, optional but recommended)

VS Code is a code editor. You won't write code yourself, but it's useful for:
- Looking at files Claude Code creates
- Reading error messages with syntax highlighting
- Editing the `.env.local` file when needed

1. Go to https://code.visualstudio.com → Download for Windows.
2. Run installer. **Important:** check the boxes for "Add to PATH" and "Open with Code" context menu actions on the Setup options screen.
3. Open VS Code once after install to confirm it works.

## Step 5 — Install Claude Code (5 min)

In PowerShell:
```
npm install -g @anthropic-ai/claude-code
```

Verify:
```
claude --version
```

## Step 6 — Authenticate Claude Code (5 min)

Still in PowerShell, run:
```
claude
```

It opens a browser window asking you to sign in. **Use the same Anthropic account as your Claude Pro subscription** (your @meragi.com or personal email — whichever has the Pro sub). Authorize.

Back in PowerShell, you'll see a prompt like `>`. You can type `/exit` to leave for now — we'll come back to it once setup is done.

**Note on Pro limits:** With Claude Pro, you'll hit a usage cap roughly every 5 hours during heavy use, and have to wait for the next 5-hour window. For Phase 1 building, plan to work in 1-2 hour focused sessions and break naturally. If you find yourself bouncing off limits constantly, that's the signal to consider Max 5x.

## Step 7 — Locate your existing demo repo (5 min)

You said the v5.6 demo is already on GitHub and Vercel. Open a new PowerShell window:

1. Decide where the project will live on your hard drive. I recommend `C:\Users\<YourName>\Projects\meragi-intel`. Open File Explorer, navigate to your user folder, create a `Projects` folder if it doesn't exist.
2. Find your repo URL: open https://github.com → log in → click your demo repo → green **"Code"** button → **HTTPS** tab → copy the URL.
3. In PowerShell:
   ```
   cd C:\Users\<YourName>\Projects
   git clone <paste-the-URL-here> meragi-intel
   cd meragi-intel
   ```
4. The first time you talk to GitHub from a new machine, Git asks for credentials. Do **not** type your GitHub password — that's been deprecated. Instead:
   - Go to GitHub → Profile → Settings → Developer settings (bottom of sidebar) → Personal access tokens → **Tokens (classic)** → Generate new token (classic).
   - Note: "meragi-intel local dev"
   - Expiration: 90 days (you can regenerate later)
   - Scopes: check **`repo`** (the whole top section)
   - Generate, then **copy the token immediately** — you can't see it again. Save in a password manager.
   - Back in PowerShell, when Git prompts for password, paste the token.
5. Verify the clone worked:
   ```
   ls
   ```
   You should see `index.html` (the v5.6 demo) and a `.git` folder.

## Step 8 — Save the brief files into the repo (5 min)

I created three files in our chat:
- `claude.md`
- `PHASE-1-BUILD-PLAN.md`
- `WINDOWS-SETUP.md` (this file)

Download all three to `C:\Users\<YourName>\Projects\meragi-intel\` (the repo folder you just cloned). They go in the **root** of the repo, alongside `index.html`.

Verify:
```
ls
```
Should now show: `claude.md`, `index.html`, `PHASE-1-BUILD-PLAN.md`, `WINDOWS-SETUP.md`, plus `.git`.

Don't commit them yet — Claude Code will handle that as part of M1.

## Step 9 — Create the Supabase project (10 min)

If you haven't already:
1. Go to https://supabase.com → **Start your project** → sign in with GitHub.
2. New Project: name it `meragi-intel`. Region: **Mumbai (ap-south-1)** (closest to your users in India). Database password: generate a strong one and save it in a password manager.
3. Wait ~2 minutes for provisioning.
4. Once ready: Project Settings (gear icon, bottom-left) → **API** → copy two values into your password manager:
   - **Project URL** (looks like `https://xxxxxxxxx.supabase.co`)
   - **anon public** key (long string)
5. Don't share these in chat. Claude Code will ask for them later when wiring up the app, and they go in `.env.local` (which is gitignored).

## Step 10 — Tell me you're done

Send a single message back: **"Setup done."** Optionally include:
- Any step that gave you trouble
- Whether you went with Pro-only or upgraded to Max
- Confirmation that you've found the v5.6 repo locally and the three brief files are in it

Then I'll give you the **first prompt to paste into Claude Code** to start M1.

---

## Things you do NOT need to do yet

- Don't set up Google Cloud OAuth — Claude Code walks you through that during M2.
- Don't generate a Google Sheets API service account — that's M3.
- Don't touch Vercel settings — Claude Code handles deployment configuration.
- Don't set environment variables in Vercel — same.

## If something breaks

Common issues:

**"command not found: pnpm" / "command not found: node" / etc.**
→ Restart PowerShell. If still broken, restart your computer. PATH issues on Windows are 90% solved by restarts.

**Git asks for username/password and the token paste doesn't work.**
→ The PowerShell paste behavior with tokens is finicky. Try right-clicking in the PowerShell window to paste (Ctrl+V sometimes doesn't work in the credential prompt).

**`claude` command opens browser but doesn't redirect back.**
→ Cancel, close all browser windows, run `claude` again. Sign in with the email tied to your Pro subscription, not a different one.

**Anything else.**
→ Screenshot the error, paste it into Opus chat, ask. Don't waste 30 minutes Googling — beginner Windows + Node ecosystem issues are exactly what this chat is for.
