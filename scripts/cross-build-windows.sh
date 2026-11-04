#!/bin/bash
# Build Nubby's Windows installer on Linux (tested on Ubuntu 24.04), without a
# Windows machine. Normally you'd use `npm run tauri build` on Windows or the
# GitHub Actions workflow instead — this is the fallback that made v0.1.0.
#
# What it does:
#   1. installs MinGW, NSIS and Ubuntu's Rust 1.91 with its standard-library
#      sources (needs sudo),
#   2. cross-compiles the app for x86_64-pc-windows-gnu with -Zbuild-std,
#   3. packages Nubby.exe + WebView2Loader.dll with installer/nubby.nsi.
#
# Output: release/Nubby_<version>_x64-setup.exe
set -euo pipefail
cd "$(dirname "$0")/.."

RUST=1.91
LIB=/usr/lib/rust-$RUST/lib/rustlib/src/rust/library

if ! command -v cargo-$RUST >/dev/null || ! command -v makensis >/dev/null; then
  sudo apt-get update
  sudo apt-get install -y mingw-w64 nsis rustc-$RUST cargo-$RUST rust-$RUST-src libstd-rust-$RUST-dev
fi

# Debian's std sources drop std's dependency on its own windows-targets crate.
if ! grep -q "Restored for Windows cross builds" "$LIB/std/Cargo.toml"; then
  sudo tee -a "$LIB/std/Cargo.toml" >/dev/null <<'TOML'

# Restored for Windows cross builds (Debian strips this upstream dependency).
[target.'cfg(windows)'.dependencies.windows-targets]
path = "../windows_targets"
TOML
fi

# rsbegin.o / rsend.o normally ship with rustup's windows-gnu target.
OBJ=/usr/lib/rust-$RUST/lib/rustlib/x86_64-pc-windows-gnu/lib
if [ ! -f "$OBJ/rsend.o" ]; then
  sudo mkdir -p "$OBJ"
  for f in rsbegin rsend; do
    sudo env RUSTC_BOOTSTRAP=1 /usr/bin/rustc-$RUST --target x86_64-pc-windows-gnu --emit=obj \
      --crate-type=lib -C panic=abort -C opt-level=2 -o "$OBJ/$f.o" "$LIB/rtstartup/$f.rs"
  done
fi

npm ci
npm run build

(
  cd src-tauri
  export RUSTC=/usr/bin/rustc-$RUST RUSTC_BOOTSTRAP=1
  export CARGO_RESOLVER_INCOMPATIBLE_RUST_VERSIONS=fallback
  export CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER=x86_64-w64-mingw32-gcc
  export CC_x86_64_pc_windows_gnu=x86_64-w64-mingw32-gcc
  export CXX_x86_64_pc_windows_gnu=x86_64-w64-mingw32-g++
  export AR_x86_64_pc_windows_gnu=x86_64-w64-mingw32-ar
  export RC_x86_64_pc_windows_gnu=x86_64-w64-mingw32-windres
  export CARGO_PROFILE_RELEASE_LTO=thin CARGO_PROFILE_RELEASE_CODEGEN_UNITS=8
  touch src/lib.rs # re-embed the freshly built ../dist
  cargo-$RUST build --release --target x86_64-pc-windows-gnu -Zbuild-std --features tauri/custom-protocol
)

mkdir -p installer/payload release
cp src-tauri/target/x86_64-pc-windows-gnu/release/nubby.exe installer/payload/Nubby.exe
cp "$(ls -d src-tauri/target/x86_64-pc-windows-gnu/release/build/webview2-com-sys-*/out | head -1)/x64/WebView2Loader.dll" installer/payload/
cp src-tauri/icons/icon.ico installer/nubby.ico
makensis -V2 installer/nubby.nsi
ls -la release/
