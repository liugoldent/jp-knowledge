import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const output = path.join(root, "docs");
const source = path.join(root, "web");
const contentFolders = ["Lyrics", "Grammer", "Vocabulary"];

async function markdownFiles(directory) {
  try {
    return (await readdir(path.join(root, directory), { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => path.join(directory, entry.name));
  } catch {
    return [];
  }
}

const files = ["日本語知識庫.md"];
for (const folder of contentFolders) files.push(...(await markdownFiles(folder)));

const notes = await Promise.all(
  files.map(async (file) => {
    const markdown = await readFile(path.join(root, file), "utf8");
    const heading = markdown.match(/^#\s+(.+)$/m)?.[1] ?? path.basename(file, ".md");
    const category = file.includes("/") ? file.split("/")[0] : "首頁";
    return {
      id: file.replace(/\.md$/, ""),
      file,
      title: heading.replace(/（[^）]*）/g, "").trim(),
      fullTitle: heading,
      category,
      markdown,
    };
  }),
);

notes.sort((a, b) => {
  const order = { 首頁: 0, Lyrics: 1, Grammer: 2, Vocabulary: 3 };
  return (order[a.category] ?? 9) - (order[b.category] ?? 9) ||
    a.fullTitle.localeCompare(b.fullTitle, "ja");
});

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(source, output, { recursive: true });
await writeFile(path.join(output, ".nojekyll"), "");
await writeFile(
  path.join(output, "content.js"),
  `window.JP_NOTES = ${JSON.stringify(notes).replace(/<\/script/gi, "<\\/script")};\n`,
);

const cacheFiles = ["./", "./index.html", "./styles.css", "./app.js", "./content.js", "./manifest.webmanifest"];
await writeFile(
  path.join(output, "sw.js"),
  `const CACHE = "jp-knowledge-v${Date.now()}";\n` +
    `const FILES = ${JSON.stringify(cacheFiles)};\n` +
    `self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting())));\n` +
    `self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));\n` +
    `self.addEventListener("fetch", event => { if (event.request.method !== "GET") return; event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); return response; }).catch(() => caches.match("./index.html")))); });\n`,
);

console.log(`Built ${notes.length} notes into docs/`);
