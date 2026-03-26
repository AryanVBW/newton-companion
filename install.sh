#!/bin/bash
set -e

# ─────────────────────────────────────────────────────────────
# Newton Companion — macOS Installer
# curl -fsSL https://raw.githubusercontent.com/AryanVBW/newton-companion/main/install.sh | bash
# ─────────────────────────────────────────────────────────────

REPO="AryanVBW/newton-companion"
APP_NAME="Newton Companion"
APP_BUNDLE="Newton Companion.app"
INSTALL_DIR="/Applications"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; exit 1; }
info() { echo -e "  ${CYAN}→${NC} $1"; }
step_header() {
  echo ""
  echo -e "${BLUE}[$1/$TOTAL_STEPS]${NC} ${BOLD}$2${NC}"
  echo "────────────────────────────────────────"
}

TOTAL_STEPS=5

echo ""
echo -e "${BOLD}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║                                               ║${NC}"
echo -e "${BOLD}║   🎓  Newton Companion — macOS Installer      ║${NC}"
echo -e "${BOLD}║                                               ║${NC}"
echo -e "${BOLD}╚═══════════════════════════════════════════════╝${NC}"
echo ""

# ─── 1. Detect architecture ───
step_header 1 "Detecting system"

ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
  SUFFIX="apple-silicon"
  ok "Apple Silicon (M-series) detected"
elif [ "$ARCH" = "x86_64" ]; then
  SUFFIX="intel"
  ok "Intel Mac detected"
else
  fail "Unsupported architecture: $ARCH"
fi

OS=$(sw_vers -productVersion 2>/dev/null || echo "unknown")
ok "macOS $OS"

# ─── 2. Fetch latest release ───
step_header 2 "Fetching latest release"

info "Checking GitHub releases..."

# Get latest release info
RELEASE_JSON=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" 2>/dev/null) || {
  fail "Could not fetch releases from GitHub. Check your internet connection."
}

VERSION=$(echo "$RELEASE_JSON" | grep '"tag_name"' | head -1 | sed 's/.*"tag_name": *"//;s/".*//')
RELEASE_NAME=$(echo "$RELEASE_JSON" | grep '"name"' | head -1 | sed 's/.*"name": *"//;s/".*//')

if [ -z "$VERSION" ]; then
  fail "No releases found. The app hasn't been built yet."
fi

ok "Latest: $RELEASE_NAME ($VERSION)"

# Find the right zip for this architecture
ZIP_URL=$(echo "$RELEASE_JSON" | grep '"browser_download_url"' | grep "$SUFFIX.zip" | head -1 | sed 's/.*"browser_download_url": *"//;s/".*//')
DMG_URL=$(echo "$RELEASE_JSON" | grep '"browser_download_url"' | grep "$SUFFIX.dmg" | head -1 | sed 's/.*"browser_download_url": *"//;s/".*//')

# Prefer zip for automated install, fall back to dmg
if [ -n "$ZIP_URL" ]; then
  DOWNLOAD_URL="$ZIP_URL"
  DOWNLOAD_TYPE="zip"
  ok "Found zip package for $SUFFIX"
elif [ -n "$DMG_URL" ]; then
  DOWNLOAD_URL="$DMG_URL"
  DOWNLOAD_TYPE="dmg"
  ok "Found DMG package for $SUFFIX"
else
  fail "No package found for $SUFFIX architecture in release $VERSION"
fi

# ─── 3. Download and install ───
step_header 3 "Downloading and installing"

TMPDIR_INSTALL=$(mktemp -d)
trap "rm -rf $TMPDIR_INSTALL" EXIT

DOWNLOAD_FILE="$TMPDIR_INSTALL/newton-companion.$DOWNLOAD_TYPE"

info "Downloading $(basename "$DOWNLOAD_URL")..."
curl -fSL --progress-bar -o "$DOWNLOAD_FILE" "$DOWNLOAD_URL" || {
  fail "Download failed"
}
ok "Download complete"

if [ "$DOWNLOAD_TYPE" = "zip" ]; then
  info "Extracting..."
  unzip -q -o "$DOWNLOAD_FILE" -d "$TMPDIR_INSTALL" || fail "Extraction failed"

  # Find the .app inside
  APP_PATH=$(find "$TMPDIR_INSTALL" -name "*.app" -maxdepth 2 -type d | head -1)
  if [ -z "$APP_PATH" ]; then
    fail "Could not find .app in zip"
  fi

  # Remove old version if exists
  if [ -d "$INSTALL_DIR/$APP_BUNDLE" ]; then
    warn "Removing previous installation..."
    rm -rf "$INSTALL_DIR/$APP_BUNDLE"
  fi

  info "Installing to $INSTALL_DIR..."
  cp -R "$APP_PATH" "$INSTALL_DIR/" || {
    warn "Need admin access to install to /Applications"
    sudo cp -R "$APP_PATH" "$INSTALL_DIR/"
  }

  # Remove quarantine flag so macOS doesn't block it
  xattr -rd com.apple.quarantine "$INSTALL_DIR/$APP_BUNDLE" 2>/dev/null || true

  ok "Installed to $INSTALL_DIR/$APP_BUNDLE"

elif [ "$DOWNLOAD_TYPE" = "dmg" ]; then
  info "Mounting DMG..."
  MOUNT_POINT=$(hdiutil attach "$DOWNLOAD_FILE" -nobrowse -noverify 2>/dev/null | tail -1 | awk '{print $NF}')

  if [ -z "$MOUNT_POINT" ] || [ ! -d "$MOUNT_POINT" ]; then
    # Try to find mount point
    MOUNT_POINT=$(hdiutil attach "$DOWNLOAD_FILE" -nobrowse -noverify 2>&1 | grep "/Volumes" | awk -F'\t' '{print $NF}' | head -1)
  fi

  APP_PATH=$(find "$MOUNT_POINT" -name "*.app" -maxdepth 1 -type d 2>/dev/null | head -1)
  if [ -z "$APP_PATH" ]; then
    hdiutil detach "$MOUNT_POINT" 2>/dev/null || true
    fail "Could not find .app in DMG"
  fi

  # Remove old version
  if [ -d "$INSTALL_DIR/$APP_BUNDLE" ]; then
    warn "Removing previous installation..."
    rm -rf "$INSTALL_DIR/$APP_BUNDLE"
  fi

  info "Installing to $INSTALL_DIR..."
  cp -R "$APP_PATH" "$INSTALL_DIR/" || {
    warn "Need admin access..."
    sudo cp -R "$APP_PATH" "$INSTALL_DIR/"
  }

  hdiutil detach "$MOUNT_POINT" 2>/dev/null || true

  xattr -rd com.apple.quarantine "$INSTALL_DIR/$APP_BUNDLE" 2>/dev/null || true

  ok "Installed to $INSTALL_DIR/$APP_BUNDLE"
fi

# ─── 4. Check newton-mcp dependency ───
step_header 4 "Checking dependencies"

# Check if Node.js exists (needed for newton-mcp)
if command -v node &>/dev/null; then
  ok "Node.js $(node -v) found"
else
  warn "Node.js not found"
  info "Installing Node.js via Homebrew..."
  if command -v brew &>/dev/null; then
    brew install node
    ok "Node.js installed"
  else
    warn "Homebrew not found — installing Homebrew first..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    if [ -f /opt/homebrew/bin/brew ]; then
      eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
    brew install node
    ok "Node.js installed"
  fi
fi

# Check newton-mcp
if command -v newton-mcp &>/dev/null; then
  ok "newton-mcp found at $(which newton-mcp)"
else
  info "Installing @newtonschool/newton-mcp..."
  npm install -g @newtonschool/newton-mcp 2>/dev/null || {
    # Try with sudo if global install fails
    sudo npm install -g @newtonschool/newton-mcp
  }
  if command -v newton-mcp &>/dev/null; then
    ok "newton-mcp installed"
  else
    warn "newton-mcp installed but not on PATH — the app will handle this"
  fi
fi

# Check login status
info "Checking Newton School login status..."
MCP_OUTPUT=$(newton-mcp status 2>&1 || true)

if echo "$MCP_OUTPUT" | grep -qi "authenticated\|logged in\|expires"; then
  ok "Logged in to Newton School"
  echo ""
  echo -e "  ${DIM}─── Account Details ───${NC}"
  echo "$MCP_OUTPUT" | while IFS= read -r line; do
    [ -n "$line" ] && echo -e "  ${DIM}$line${NC}"
  done
  echo -e "  ${DIM}───────────────────────${NC}"
else
  warn "Not logged in to Newton School"
  echo ""
  echo -e "  ${YELLOW}You need to sign in to use Newton Companion.${NC}"
  echo -e "  ${YELLOW}Starting login now...${NC}"
  echo ""
  echo -e "  ${CYAN}A device code will appear below.${NC}"
  echo -e "  ${CYAN}Visit the URL and enter the code to authenticate.${NC}"
  echo ""

  newton-mcp login 2>&1 || {
    echo ""
    warn "Login was cancelled or failed"
    info "You can sign in later from inside the app"
  }

  # Check again after login attempt
  MCP_OUTPUT=$(newton-mcp status 2>&1 || true)
  if echo "$MCP_OUTPUT" | grep -qi "authenticated\|logged in\|expires"; then
    echo ""
    ok "Login successful!"
  fi
fi

# ─── 5. Done ───
step_header 5 "Setup complete"

echo ""
echo -e "${GREEN}${BOLD}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║                                               ║${NC}"
echo -e "${GREEN}${BOLD}║   Newton Companion installed successfully!    ║${NC}"
echo -e "${GREEN}${BOLD}║                                               ║${NC}"
echo -e "${GREEN}${BOLD}╚═══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Location:${NC}  $INSTALL_DIR/$APP_BUNDLE"
echo -e "  ${BOLD}Version:${NC}   $VERSION"
echo ""
echo -e "  ${BOLD}To open:${NC}"
echo -e "    open \"$INSTALL_DIR/$APP_BUNDLE\""
echo ""
echo -e "  ${BOLD}To uninstall:${NC}"
echo -e "    rm -rf \"$INSTALL_DIR/$APP_BUNDLE\""
echo ""

# Ask to open
read -rp "  Open Newton Companion now? (y/n) " -n 1 REPLY 2>/dev/null || REPLY="n"
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  info "Launching Newton Companion..."
  open "$INSTALL_DIR/$APP_BUNDLE"
fi
