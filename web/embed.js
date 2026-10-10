// Loads Freedoom + the Chocolate Doom WebAssembly build (web/doom/) into the canvas.
// Runs both inside the X player-card iframe and as a normal page.

import { isTouchDevice, setupTouchControls, showTouchControls } from "./touch.js";

const WAD_URL = "doom/freedoom1.wad.gz";
const WAD_GZ_SIZE = 10456425; // fallback for the progress bar if Content-Length is missing
const CFG_URL = "doom/doom.cfg";
const GAME_ARGS = [
  "-iwad", "freedoom1.wad",
  "-config", "doom.cfg",
  "-extraconfig", "doom.cfg",
  "-window", "-nogui",
  // Straight into E1M1 on "Hurt me plenty": people clicking a post want action, not a title screen.
  "-warp", "1", "1", "-skill", "3",
];

const $ = (id) => document.getElementById(id);
const canvas = $("canvas");
const overlay = $("overlay");
const statusEl = $("status");
const barFill = $("bar-fill");
const playBtn = $("play");

if (window.top === window.self) document.body.classList.add("top-level");
const touch = isTouchDevice();
const touchRoot = $("touch");
if (touch) {
  document.body.classList.add("touch");
  playBtn.textContent = "▶ TOQUE PARA JOGAR";
  setupTouchControls(touchRoot);
}

function setStatus(text, fraction) {
  statusEl.textContent = text;
  if (fraction !== undefined) barFill.style.width = `${Math.round(fraction * 100)}%`;
}

async function download(url, expectedSize, label) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const total = Number(res.headers.get("content-length")) || expectedSize;
  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    const frac = Math.min(received / total, 1);
    setStatus(`${label}... ${Math.round(frac * 100)}%`, frac);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  return bytes;
}

// Some hosts transparently decode .gz responses; only inflate if the gzip magic is still there.
async function gunzipIfNeeded(bytes) {
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes;
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
    document.body.appendChild(s);
  });
}

function showError(err) {
  console.error(err);
  overlay.classList.remove("gone");
  playBtn.hidden = true;
  $("loading").hidden = false;
  setStatus(`Erro: ${err.message || err}. Recarregue a página.`);
}

let started = false;

function startGame(wad, cfg) {
  started = true;
  overlay.classList.add("gone");
  if (touch) showTouchControls(touchRoot);
  canvas.focus();

  window.Module = {
    canvas,
    noInitialRun: true,
    locateFile: (file) => `doom/${file}`,
    preRun: [
      () => {
        Module.FS.writeFile("/freedoom1.wad", wad);
        Module.FS.writeFile("/doom.cfg", cfg);
      },
    ],
    onRuntimeInitialized: () => Module.callMain(GAME_ARGS),
    print: (text) => console.log(text),
    printErr: (text) => console.warn(text),
    onExit: () => {
      touchRoot.hidden = true;
      overlay.classList.remove("gone");
      playBtn.hidden = false;
      playBtn.textContent = "▶ JOGAR DE NOVO";
      playBtn.onclick = () => location.reload();
    },
    onAbort: (what) => showError(new Error(String(what))),
  };

  loadScript("doom/doom.js").catch(showError);
}

async function init() {
  try {
    const [wadGz, cfg] = await Promise.all([
      download(WAD_URL, WAD_GZ_SIZE, "Baixando o inferno"),
      fetch(CFG_URL).then((r) => r.text()),
    ]);
    setStatus("Descompactando...", 1);
    const wad = await gunzipIfNeeded(wadGz);

    $("loading").hidden = true;
    playBtn.hidden = false;
    playBtn.focus();
    playBtn.onclick = () => startGame(wad, cfg);
  } catch (err) {
    showError(err);
  }
}

// Only loading failures are fatal. Once the game runs, stray errors (e.g. pointer lock refused
// inside a sandboxed card iframe) must not cover it; the keyboard still works.
window.addEventListener("error", (e) => {
  if (!started) showError(e.error || e.message);
});
init();
