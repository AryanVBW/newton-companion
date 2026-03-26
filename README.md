# Newton Companion

A native macOS desktop app for Newton School students. Syncs your real course data, lectures, assignments, coding arena, and more — powered by MCP (Model Context Protocol).

Built with **Tauri 2 + React 19 + TypeScript + Rust**.

## Install (users)

### One-command install
```bash
curl -fsSL https://raw.githubusercontent.com/AryanVBW/newton-companion/main/install.sh | bash
```

This will:
- Download the latest release for your Mac (Apple Silicon or Intel)
- Install the app to `/Applications`
- Check and install `newton-mcp` if needed
- Sign you in to Newton School (device code flow)
- Launch the app

### Manual install
1. Go to [Releases](https://github.com/AryanVBW/newton-companion/releases)
2. Download the `.dmg` for your Mac:
   - **Apple Silicon** (M1/M2/M3/M4): `*-apple-silicon.dmg`
   - **Intel**: `*-intel.dmg`
3. Open the DMG and drag to Applications
4. Open Terminal and run `newton-mcp login` if not already signed in

## Build from source (developers)

### One-command dev setup
```bash
curl -fsSL https://raw.githubusercontent.com/AryanVBW/newton-companion/main/setup.sh | bash
```

### Manual setup

**Prerequisites:** Node.js 18+, Rust 1.77+, Xcode Command Line Tools

```bash
git clone https://github.com/AryanVBW/newton-companion.git
cd newton-companion
npm install
npm run tauri:dev
```

### Build a release
```bash
npm run tauri:build
```

Output: `src-tauri/target/release/bundle/` (contains `.dmg` and `.app`)

## Release workflow

Releases are built via GitHub Actions. To create a new release:

1. Go to **Actions** > **Build & Release**
2. Click **Run workflow**
3. Enter the version (e.g. `0.2.0`)
4. Toggle pre-release if needed
5. Run — builds for both Apple Silicon and Intel, uploads to GitHub Releases

## Architecture

```
newton-companion/
├── src/                    # React frontend
│   ├── components/ui/      # Shared UI components
│   ├── pages/              # Dashboard, Lectures, Assignments, Arena, Chat, Settings
│   ├── stores/             # Zustand global stores (auth, data, ui)
│   └── hooks/              # React hooks (MCP, theme)
├── src-tauri/              # Rust backend
│   └── src/
│       ├── mcp/            # MCP protocol, transport, server manager
│       ├── commands/       # Tauri commands (auth, sync, mcp, ai, etc.)
│       ├── db/             # SQLite migrations and cache
│       └── ai/             # Multi-provider AI brain
└── .github/workflows/      # CI/CD
```

## Key features

- **Device code auth** — sign in via Newton School, session persists in SQLite + localStorage
- **MCP integration** — discovers all newton-mcp tools, calls each, caches locally
- **Cache-first loading** — instant UI from SQLite, background sync for freshness
- **Real data** — dashboard, lectures, assignments, arena all show your actual Newton School data
- **AI chat** — multi-provider (GitHub Copilot, Claude, Gemini, OpenRouter)
- **macOS native** — login shell spawning for PATH resolution, Tauri 2 with native window

## Reset app data

```bash
bash dev-reset.sh
```

Wipes SQLite DB, WebView cache, and logs for a fresh start.
