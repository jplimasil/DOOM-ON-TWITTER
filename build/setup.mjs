// One-time setup: fetches doom-wasm sources, the Emscripten SDK and Freedoom into vendor/,
// then copies the game data into web/doom/. Safe to re-run; finished steps are skipped.

import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { paths, versions } from "./paths.mjs";

const { root, vendor, doomSrc, emsdk, freedoomDir } = paths;
const isWin = process.platform === "win32";
const python = isWin ? "python" : "python3";

function sh(cmd, args, cwd = root) {
  console.log(`> ${cmd} ${args.join(" ")}`);
  execFileSync(cmd, args, { cwd, stdio: "inherit", shell: isWin });
}

mkdirSync(vendor, { recursive: true });

// 1. doom-wasm (Chocolate Doom port), pinned to a known commit
if (!existsSync(doomSrc)) sh("git", ["clone", versions.doomWasmRepo, doomSrc]);
sh("git", ["fetch", "--depth", "1", "origin", versions.doomWasmCommit], doomSrc);
sh("git", ["checkout", "--quiet", versions.doomWasmCommit], doomSrc);

// Browser fixes on top of doom-wasm (see the comments inside the patch):
//  - doomtype.h: keep `boolean` 4 bytes even when newer Emscripten headers include <stdbool.h>
//  - opl.c: don't block the only thread waiting for an audio callback (froze the page)
//  - m_menu.c: letter shortcuts ignore game-control keys, so touch controls navigate menus sanely
const patch = path.join(root, "build", "patches", "doom-wasm-browser-fixes.patch");
try {
  execFileSync("git", ["apply", "--check", "--reverse", patch], { cwd: doomSrc, stdio: "ignore" });
  console.log("> patch already applied");
} catch {
  sh("git", ["apply", patch], doomSrc);
}

// 2. Emscripten SDK
const emsdkCmd = path.join(emsdk, isWin ? "emsdk.bat" : "emsdk");
if (!existsSync(emsdk)) sh("git", ["clone", "--depth", "1", versions.emsdkRepo, emsdk]);
if (!existsSync(path.join(emsdk, "upstream", "emscripten"))) {
  sh(emsdkCmd, ["install", versions.emscripten], emsdk);
}
sh(emsdkCmd, ["activate", versions.emscripten], emsdk);

// 3. Freedoom (BSD-licensed replacement for the commercial Doom data)
const zip = path.join(vendor, `freedoom-${versions.freedoom}.zip`);
if (!existsSync(zip)) {
  const url = `https://github.com/freedoom/freedoom/releases/download/v${versions.freedoom}/freedoom-${versions.freedoom}.zip`;
  console.log(`> download ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Freedoom download failed: ${res.status}`);
  writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
}
if (!existsSync(freedoomDir)) sh(python, ["-m", "zipfile", "-e", zip, freedoomDir]);

// 4. Game data + licenses into the deployable site
const extracted = path.join(freedoomDir, `freedoom-${versions.freedoom}`);
const webDoom = path.join(root, "web", "doom");
const licenses = path.join(root, "LICENSES");
mkdirSync(webDoom, { recursive: true });
mkdirSync(licenses, { recursive: true });
// Shipped gzipped (28.8 MB -> ~10 MB); embed.js inflates it with DecompressionStream.
const wad = readFileSync(path.join(extracted, "freedoom1.wad"));
writeFileSync(path.join(webDoom, "freedoom1.wad.gz"), gzipSync(wad, { level: 9 }));
rmSync(path.join(webDoom, "freedoom1.wad"), { force: true });
copyFileSync(path.join(extracted, "COPYING.txt"), path.join(licenses, "FREEDOOM-COPYING.txt"));
copyFileSync(path.join(doomSrc, "COPYING.md"), path.join(licenses, "CHOCOLATE-DOOM-GPL2.md"));

console.log("\nSetup done. Next: node build/build.mjs");
