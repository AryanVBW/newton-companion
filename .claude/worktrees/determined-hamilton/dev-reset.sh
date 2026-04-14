#!/bin/bash
# dev-reset.sh — Wipe all Newton Companion data so the app runs fresh.
# macOS only. Dev mode only. Safe to run anytime.

echo "Resetting Newton Companion..."

# SQLite database (onboarding state, MCP configs, AI config, auth, etc.)
rm -rf ~/Library/Application\ Support/com.newton.companion/

# WebView cache (localStorage, cookies, Zustand persisted state)
rm -rf ~/Library/WebKit/com.newton.companion/
rm -rf ~/Library/WebKit/newton-companion/

# App cache
rm -rf ~/Library/Caches/com.newton.companion/
rm -rf ~/Library/Caches/newton-companion/

# Logs
rm -rf ~/Library/Logs/com.newton.companion/

# Rust build cache (uncomment if you want a full rebuild too)
# rm -rf src-tauri/target/

echo "Done. App will start fresh on next launch."
