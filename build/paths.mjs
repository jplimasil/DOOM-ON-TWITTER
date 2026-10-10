import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vendor = path.join(root, "vendor");

export const paths = {
  root,
  vendor,
  doomSrc: path.join(vendor, "doom-wasm"),
  emsdk: path.join(vendor, "emsdk"),
  freedoomDir: path.join(vendor, "freedoom"),
};

export const versions = {
  doomWasmRepo: "https://github.com/cloudflare/doom-wasm.git",
  doomWasmCommit: "65e0d3ae2ffa604155eebd96ed40da6567bd08f4",
  emsdkRepo: "https://github.com/emscripten-core/emsdk.git",
  emscripten: "3.1.74",
  freedoom: "0.13.0",
};

// Environment equivalent to sourcing emsdk_env, scoped to child processes.
export function emsdkEnv() {
  const { emsdk } = paths;
  const sep = process.platform === "win32" ? ";" : ":";
  return {
    ...process.env,
    EMSDK: emsdk,
    EM_CONFIG: path.join(emsdk, ".emscripten"),
    PATH: [emsdk, path.join(emsdk, "upstream", "emscripten"), process.env.PATH].join(sep),
  };
}
