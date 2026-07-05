// 依存順にESモジュールを連結して、自己完結の単一HTML (dist/inkrush.html) を生成する。
// 各モジュールは「トップレベルのimport/named export のみ」という規約で書かれており、
// import行の除去 + export接頭辞の除去だけで1つのモジュールスコープに畳み込める。
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = dirname(fileURLToPath(import.meta.url));
const order = ['constants.js', 'rng.js', 'map.js', 'engine.js', 'bot.js', 'render.js', 'input.js', 'main.js'];

let bundle = '';
for (const f of order) {
  const src = readFileSync(join(root, 'src', f), 'utf8')
    .replace(/^import .*$/gm, '')
    .replace(/^export /gm, '');
  bundle += `// ---- src/${f} ----\n${src}\n`;
}

const html = readFileSync(join(root, 'index.html'), 'utf8').replace(
  '<script type="module" src="./src/main.js"></script>',
  `<script type="module">\n${bundle}</script>`
);

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist', 'inkrush.html'), html);
console.log(`dist/inkrush.html: ${(html.length / 1024).toFixed(1)} KB`);
