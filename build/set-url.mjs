// Points the Player Card meta tags at the deployed site.
//   node build/set-url.mjs https://meu-doom.vercel.app @MeuPerfil

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { paths } from "./paths.mjs";

const [rawUrl, handle] = process.argv.slice(2);
if (!rawUrl || !/^https:\/\//.test(rawUrl)) {
  console.error("Uso: node build/set-url.mjs https://seu-projeto.vercel.app [@seuPerfil]");
  process.exit(1);
}
const base = rawUrl.replace(/\/+$/, "");
const file = path.join(paths.root, "web", "index.html");

let html = readFileSync(file, "utf8");
// Replace the origin of every absolute card URL, whatever it currently is.
html = html.replace(/(content=")https:\/\/[^"/]+(\/(?:embed\.html|thumb\.png)?")/g, `$1${base}$2`);
if (handle) {
  const at = handle.startsWith("@") ? handle : `@${handle}`;
  html = html.replace(/(<meta name="twitter:site" content=")[^"]*(")/, `$1${at}$2`);
}
writeFileSync(file, html);

console.log(`index.html -> ${base}`);
for (const m of html.matchAll(/<meta (?:name|property)="(twitter:(?:site|player|image)|og:(?:url|image))" content="([^"]*)"/g)) {
  console.log(`  ${m[1].padEnd(16)} ${m[2]}`);
}
