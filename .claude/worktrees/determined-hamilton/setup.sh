#!/bin/bash
set -e

# ─────────────────────────────────────────────────────────────
# Newton Companion — One-command macOS setup
# curl -fsSL https://raw.githubusercontent.com/AryanVBW/newton-companion/main/setup.sh | bash
# ─────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

step=0
total_steps=8

progress() {
  step=$((step + 1))
  echo ""
  echo -e "${BLUE}[$step/$total_steps]${NC} ${BOLD}$1${NC}"
  echo "────────────────────────────────────────"
}

ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; exit 1; }
info() { echo -e "  ${CYAN}→${NC} $1"; }

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   Newton Companion — macOS Setup         ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════╝${NC}"
echo ""

# ─── 1. Xcode Command Line Tools ───
progress "Checking Xcode Command Line Tools"
if xcode-select -p &>/dev/null; then
  ok "Xcode CLT already installed"
else
  info "Installing Xcode Command Line Tools..."
  xcode-select --install 2>/dev/null || true
  echo ""
  echo -e "  ${YELLOW}Xcode CLT installer should have opened.${NC}"
  echo -e "  ${YELLOW}Complete the installation, then re-run this script.${NC}"
  exit 0
fi

# ─── 2. Homebrew ───
progress "Checking Homebrew"
if command -v brew &>/dev/null; then
  ok "Homebrew found at $(which brew)"
else
  info "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Add to PATH for this session
  if [ -f /opt/homebrew/bin/brew ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  fi
  ok "Homebrew installed"
fi

# ─── 3. Node.js ───
progress "Checking Node.js"
if command -v node &>/dev/null; then
  NODE_VER=$(node -v)
  NODE_MAJOR=$(echo "$NODE_VER" | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_MAJOR" -ge 18 ]; then
    ok "Node.js $NODE_VER found"
  else
    warn "Node.js $NODE_VER is too old (need >= 18)"
    info "Installing latest Node.js via Homebrew..."
    brew install node
    ok "Node.js $(node -v) installed"
  fi
else
  info "Installing Node.js via Homebrew..."
  brew install node
  ok "Node.js $(node -v) installed"
fi

# ─── 4. Rust ───
progress "Checking Rust toolchain"
if command -v rustc &>/dev/null; then
  RUST_VER=$(rustc --version | awk '{print $2}')
  ok "Rust $RUST_VER found"
else
  info "Installing Rust via rustup..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  source "$HOME/.cargo/env"
  ok "Rust $(rustc --version | awk '{print $2}') installed"
fi

# Ensure cargo is on PATH
export PATH="$HOME/.cargo/bin:$PATH"

# ─── 5. Newton MCP ───
progress "Checking @newtonschool/newton-mcp"
if command -v newton-mcp &>/dev/null; then
  ok "newton-mcp found at $(which newton-mcp)"
else
  info "Installing @newtonschool/newton-mcp globally..."
  npm install -g @newtonschool/newton-mcp
  if command -v newton-mcp &>/dev/null; then
    ok "newton-mcp installed at $(which newton-mcp)"
  else
    warn "newton-mcp installed but not on PATH — will use npx fallback"
  fi
fi

# Check login status
info "Checking newton-mcp auth status..."
MCP_STATUS=$(newton-mcp status 2>&1 || true)
if echo "$MCP_STATUS" | grep -qi "authenticated\|logged in\|expires"; then
  ok "Already authenticated with Newton School"
else
  warn "Not logged in to Newton School"
  echo ""
  echo -e "  ${CYAN}Starting login...${NC}"
  echo -e "  ${YELLOW}A device code will appear below.${NC}"
  echo -e "  ${YELLOW}Visit the URL shown and enter the code to authenticate.${NC}"
  echo ""
  newton-mcp login 2>&1 || {
    warn "Login failed or was cancelled — you can login later from the app"
  }
fi

# ─── 6. Clone / locate repo ───
progress "Setting up Newton Companion source"
REPO_URL="https://github.com/AryanVBW/newton-companion.git"
INSTALL_DIR="$HOME/newton-companion"

if [ -f "./package.json" ] && grep -q "newton-companion" "./package.json" 2>/dev/null; then
  INSTALL_DIR="$(pwd)"
  ok "Already in newton-companion directory"
elif [ -d "$INSTALL_DIR" ] && [ -f "$INSTALL_DIR/package.json" ]; then
  ok "Found existing clone at $INSTALL_DIR"
  cd "$INSTALL_DIR"
  info "Pulling latest changes..."
  git pull origin main 2>/dev/null || true
else
  info "Cloning from $REPO_URL..."
  git clone "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
  ok "Cloned to $INSTALL_DIR"
fi

# ─── 7. Install dependencies ───
progress "Installing dependencies"
info "Installing npm packages..."
npm install
ok "npm packages installed"

info "Checking Rust dependencies (first build takes a few minutes)..."
cd src-tauri
cargo check 2>&1 | tail -3
cd ..
ok "Rust dependencies ready"

# ─── 8. Done ───
progress "Setup complete"
echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║   Newton Companion is ready!             ║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}To start the app:${NC}"
echo -e "    cd $INSTALL_DIR"
echo -e "    npm run tauri:dev"
echo ""
echo -e "  ${BOLD}To build a release:${NC}"
echo -e "    npm run tauri:build"
echo ""
echo -e "  ${BOLD}To reset all app data:${NC}"
echo -e "    bash dev-reset.sh"
echo ""

# Ask if user wants to start now
read -rp "  Start the app now? (y/n) " -n 1 REPLY
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo ""
  info "Starting Newton Companion..."
  npm run tauri:dev
fi
