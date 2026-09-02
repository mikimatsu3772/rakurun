// questions.js を index.html に埋め込んで単一ファイルにする。
// Artifact など外部ファイルを読めない環境に配布するとき用。
//   node build.mjs [出力先]  (省略時 dist/index.html)
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(process.argv[2] ?? `${here}/dist/index.html`);

const html = await readFile(`${here}/index.html`, "utf8");
const questions = await readFile(`${here}/questions.js`, "utf8");

const tag = '<script src="questions.js"></script>';
if (!html.includes(tag)) {
  throw new Error(`index.html に ${tag} が見つかりません`);
}

// </script> がデータ側に現れると script 要素が途中で閉じてしまうため退避する
const safe = questions.replace(/<\/script/gi, "<\\/script");

await mkdir(dirname(out), { recursive: true });
await writeFile(out, html.replace(tag, `<script>\n${safe}\n</script>`), "utf8");

console.log(`${out} を生成しました (${(await readFile(out)).length.toLocaleString()} bytes)`);
