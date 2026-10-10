// On-screen touch controls. Each control fires synthetic keyboard events on `window`,
// which is where Emscripten's SDL2 listens; SDL maps them by `event.code`, so the game
// can't tell them apart from a real keyboard (bindings live in doom/doom.cfg).

const KEYS = {
  forward: [{ code: "KeyW", key: "w" }, { code: "ArrowUp", key: "ArrowUp" }], // arrows drive the menu
  back: [{ code: "KeyS", key: "s" }, { code: "ArrowDown", key: "ArrowDown" }],
  left: [{ code: "ArrowLeft", key: "ArrowLeft" }],
  right: [{ code: "ArrowRight", key: "ArrowRight" }],
  fire: [{ code: "Space", key: " " }],
  use: [{ code: "KeyE", key: "e" }, { code: "Enter", key: "Enter" }], // Enter = confirm in menus
  weapon: [{ code: "KeyQ", key: "q" }],
  menu: [{ code: "Escape", key: "Escape" }],
};

const held = new Set();

function send(type, { code, key }) {
  window.dispatchEvent(new KeyboardEvent(type, { code, key, bubbles: true, cancelable: true }));
}

function press(action) {
  if (held.has(action)) return;
  held.add(action);
  KEYS[action].forEach((k) => send("keydown", k));
}

function release(action) {
  if (!held.delete(action)) return;
  KEYS[action].forEach((k) => send("keyup", k));
}

function releaseAll() {
  [...held].forEach(release);
}

// Capture is a nicety (keeps tracking a finger that slides off the control); some browsers
// refuse it, so never let it throw. Releases are also caught on window, below.
function capture(el, pointerId) {
  try {
    el.setPointerCapture(pointerId);
  } catch {}
}

// pointerId -> callback, so a finger lifted anywhere still releases its control.
const enders = new Map();
for (const type of ["pointerup", "pointercancel"]) {
  window.addEventListener(type, (e) => {
    const end = enders.get(e.pointerId);
    if (end) {
      enders.delete(e.pointerId);
      end();
    }
  });
}

// Joystick: up/down walks, left/right turns. Diagonals press both.
function setupStick(base) {
  const knob = base.querySelector(".knob");
  const DEAD = 0.3;
  let pointerId = null;

  const update = (e) => {
    const r = base.getBoundingClientRect();
    const radius = r.width / 2;
    let dx = (e.clientX - (r.left + radius)) / radius;
    let dy = (e.clientY - (r.top + radius)) / radius;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    knob.style.transform = `translate(${dx * radius * 0.55}px, ${dy * radius * 0.55}px)`;
    dy < -DEAD ? press("forward") : release("forward");
    dy > DEAD ? press("back") : release("back");
    dx < -DEAD ? press("left") : release("left");
    dx > DEAD ? press("right") : release("right");
  };

  const end = () => {
    pointerId = null;
    knob.style.transform = "";
    ["forward", "back", "left", "right"].forEach(release);
  };

  base.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    pointerId = e.pointerId;
    enders.set(pointerId, end);
    capture(base, pointerId);
    update(e);
  });
  // On window: without capture, the finger may leave the stick while still steering.
  window.addEventListener("pointermove", (e) => {
    if (e.pointerId === pointerId) update(e);
  });
}

// Buttons hold their key while the finger is down.
function setupButton(btn) {
  const action = btn.dataset.action;
  const up = () => {
    btn.classList.remove("on");
    release(action);
  };
  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    btn.classList.add("on");
    press(action);
    enders.set(e.pointerId, up);
    capture(btn, e.pointerId);
    if (action === "fire" && navigator.vibrate) navigator.vibrate(8);
  });
}

export function isTouchDevice() {
  return matchMedia("(pointer: coarse)").matches || (navigator.maxTouchPoints > 0 && !matchMedia("(any-pointer: fine)").matches);
}

export function setupTouchControls(root) {
  setupStick(root.querySelector(".stick"));
  root.querySelectorAll("[data-action]").forEach(setupButton);
  root.addEventListener("contextmenu", (e) => e.preventDefault());
  // Never leave a key stuck down when the page loses focus.
  window.addEventListener("blur", releaseAll);
  document.addEventListener("visibilitychange", releaseAll);
}

export function showTouchControls(root) {
  root.hidden = false;
}
