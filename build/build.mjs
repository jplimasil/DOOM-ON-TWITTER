// Compiles cloudflare/doom-wasm (Chocolate Doom) to WebAssembly with plain emcc.
// No autotools/make needed, so it works on Windows, macOS and Linux.
//
//   node build/setup.mjs   (once: fetches the sources, Emscripten and Freedoom)
//   node build/build.mjs   (outputs web/doom/doom.js + web/doom/doom.wasm)

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { emsdkEnv, paths } from "./paths.mjs";

const { root, doomSrc, emsdk } = paths;
const outDir = path.join(root, "web", "doom");
const objDir = path.join(root, "build", "obj");

// Source lists mirror src/Makefile.am, src/doom/Makefile.am, textscreen/, opl/ and pcsound/.
// Platform-specific files (win32, linux, bsd) are #ifdef'd out and compile to nothing.
const sources = {
  src: [
    "i_main.c", "i_system.c", "m_argv.c", "m_misc.c",
    "aes_prng.c", "d_event.c", "d_iwad.c", "d_loop.c", "d_mode.c", "deh_str.c", "gusconf.c",
    "i_cdmus.c", "i_endoom.c", "i_glob.c", "i_input.c", "i_joystick.c", "i_midipipe.c",
    "i_musicpack.c", "i_oplmusic.c", "i_pcsound.c", "i_sdlmusic.c", "i_sdlsound.c", "i_sound.c",
    "i_timer.c", "i_video.c", "i_videohr.c", "midifile.c", "mus2mid.c", "m_bbox.c", "m_cheat.c",
    "m_config.c", "m_controls.c", "m_fixed.c", "net_client.c", "net_common.c", "net_dedicated.c",
    "net_gui.c", "net_io.c", "net_loop.c", "net_websockets.c", "net_packet.c", "net_petname.c",
    "net_query.c", "net_server.c", "net_structrw.c", "sha1.c", "memio.c", "tables.c",
    "v_diskicon.c", "v_video.c", "w_checksum.c", "w_main.c", "w_wad.c", "w_file.c",
    "w_file_stdc.c", "w_file_posix.c", "w_file_win32.c", "w_merge.c", "z_zone.c",
    "deh_io.c", "deh_main.c", "deh_mapping.c", "deh_text.c",
  ],
  "src/doom": [
    "am_map.c", "deh_ammo.c", "deh_bexstr.c", "deh_cheat.c", "deh_doom.c", "deh_frame.c",
    "deh_misc.c", "deh_ptr.c", "deh_sound.c", "deh_thing.c", "deh_weapon.c", "d_items.c",
    "d_main.c", "d_net.c", "doomdef.c", "doomstat.c", "dstrings.c", "f_finale.c", "f_wipe.c",
    "g_game.c", "hu_lib.c", "hu_stuff.c", "info.c", "m_menu.c", "m_random.c", "p_ceilng.c",
    "p_doors.c", "p_enemy.c", "p_floor.c", "p_inter.c", "p_lights.c", "p_map.c", "p_maputl.c",
    "p_mobj.c", "p_plats.c", "p_pspr.c", "p_saveg.c", "p_setup.c", "p_sight.c", "p_spec.c",
    "p_switch.c", "p_telept.c", "p_tick.c", "p_user.c", "r_bsp.c", "r_data.c", "r_draw.c",
    "r_main.c", "r_plane.c", "r_segs.c", "r_sky.c", "r_things.c", "s_sound.c", "sounds.c",
    "statdump.c", "st_lib.c", "st_stuff.c", "wi_stuff.c",
  ],
  textscreen: [
    "txt_conditional.c", "txt_checkbox.c", "txt_desktop.c", "txt_dropdown.c", "txt_fileselect.c",
    "txt_gui.c", "txt_inputbox.c", "txt_io.c", "txt_button.c", "txt_label.c",
    "txt_radiobutton.c", "txt_scrollpane.c", "txt_separator.c", "txt_spinctrl.c", "txt_sdl.c",
    "txt_strut.c", "txt_table.c", "txt_utf8.c", "txt_widget.c", "txt_window.c",
    "txt_window_action.c",
  ],
  opl: [
    "opl.c", "opl_linux.c", "opl_obsd.c", "opl_queue.c", "opl_sdl.c", "opl_timer.c",
    "opl_win32.c", "ioperm_sys.c", "opl3.c",
  ],
  pcsound: ["pcsound.c", "pcsound_bsd.c", "pcsound_sdl.c", "pcsound_linux.c", "pcsound_win32.c"],
};

const ports = ["-sUSE_SDL=2", "-sUSE_SDL_MIXER=2", "-sUSE_SDL_NET=2"];

const compileFlags = [
  "-O3",
  `-I${path.join(root, "build")}`, // our config.h
  ...["src", "src/doom", "textscreen", "opl", "pcsound"].map((d) => `-I${path.join(doomSrc, d)}`),
  ...ports,
  // Chocolate Doom is old C; only keep the warnings that mean real breakage in wasm.
  "-Wno-everything",
  "-Werror=implicit-function-declaration",
  "-Werror=int-conversion",
  "-Werror=incompatible-function-pointer-types",
  "-Werror=return-type",
];

const linkFlags = [
  "-O3",
  ...ports,
  "-sASYNCIFY",
  "-sINVOKE_RUN=0",
  "-sFORCE_FILESYSTEM=1",
  "-sEXPORTED_RUNTIME_METHODS=FS,callMain",
  "-sINITIAL_MEMORY=64MB",
  "-sALLOW_MEMORY_GROWTH=1",
  "-sEXIT_RUNTIME=1",
  "-sENVIRONMENT=web",
  "-sERROR_ON_UNDEFINED_SYMBOLS=0",
  "-lwebsocket.js",
];

const emcc = path.join(emsdk, "upstream", "emscripten", process.platform === "win32" ? "emcc.bat" : "emcc");

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(emcc, args, { env: emsdkEnv(), shell: process.platform === "win32" });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`emcc ${args.at(-1)} failed:\n${out}`))));
  });
}

async function main() {
  if (!existsSync(emcc)) throw new Error("Emscripten not found. Run: node build/setup.mjs");
  if (process.argv.includes("--clean")) rmSync(objDir, { recursive: true, force: true });
  mkdirSync(objDir, { recursive: true });
  mkdirSync(outDir, { recursive: true });

  const jobs = Object.entries(sources).flatMap(([dir, files]) =>
    files.map((file) => {
      const src = path.join(doomSrc, dir, file);
      const obj = path.join(objDir, `${dir.replace("/", "_")}_${file.replace(/\.c$/, ".o")}`);
      return { src, obj };
    }),
  );

  // The first compile builds the SDL ports into the Emscripten cache; doing it alone avoids races.
  const stale = jobs.filter(({ src, obj }) => !existsSync(obj) || statSync(obj).mtimeMs < statSync(src).mtimeMs);
  console.log(`Compiling ${stale.length}/${jobs.length} files...`);
  let done = 0;
  const compile = async ({ src, obj }) => {
    await run([...compileFlags, "-c", src, "-o", obj]);
    if (++done % 20 === 0 || done === stale.length) console.log(`  ${done}/${stale.length}`);
  };
  if (stale.length) await compile(stale[0]);
  const queue = stale.slice(1);
  const workers = Array.from({ length: Math.max(1, cpus().length) }, async () => {
    while (queue.length) await compile(queue.shift());
  });
  await Promise.all(workers);
  console.log();

  // Object list goes in a response file: 156 paths overflow the Windows command-line limit.
  console.log("Linking...");
  const rsp = path.join(objDir, "objects.rsp");
  writeFileSync(rsp, jobs.map((j) => `"${j.obj.replaceAll("\\", "/")}"`).join("\n"));
  await run([...linkFlags, `@${rsp}`, "-o", path.join(outDir, "doom.js")]);
  console.log(`OK -> ${path.relative(root, outDir)}${path.sep}doom.js / doom.wasm`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
