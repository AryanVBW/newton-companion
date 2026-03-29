# Newton Companion

A native macOS desktop app for Newton School students. Syncs your real course data, lectures, assignments, coding arena, and more — powered by MCP (Model Context Protocol).
<img width="1440" height="2076" alt="image" src="https://github.com/user-attachments/assets/2e9f2f60-d9a5-4950-8c09-aaff05319421" />



## Install (users)

### One-command install
```bash
curl -fsSL https://raw.githubusercontent.com/AryanVBW/newton-companion/main/install.sh | bash
```


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


## Reset app data

```bash
bash dev-reset.sh
```

Wipes SQLite DB, WebView cache, and logs for a fresh start.
