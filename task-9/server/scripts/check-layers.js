import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Проверка разделения приложения на три слоя (пункт 2 задания).
 *
 * Запуск: node server/scripts/check-layers.js
 *
 * Скрипт разбирает импорты во всех модулях сервера и проверяет, что
 * зависимости между слоями идут строго в одну сторону:
 *
 *   routes → services → repositories → db
 *
 * Нарушение правила — это не стилистическая придирка, а признак того,
 * что слои перемешались: например, маршрут, который сам пишет SQL,
 * или сервис, который знает про Express.
 */

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Правила: какой слой что кому импортировать разрешено. */
const ALLOWED = {
  routes: ['services', 'utils'],
  services: ['repositories', 'utils'],
  repositories: ['db', 'utils'],
  utils: [],
  app: ['routes', 'services', 'utils', 'config', 'db'],
  server: ['app', 'config', 'db', 'scripts'],
  scripts: ['services', 'repositories', 'db', 'utils', 'config', 'scripts'],
  config: [],
  db: ['config'],
};

/** Слои, в которые нельзя импортировать напрямую. */
const FORBIDDEN = {
  routes: ['repositories', 'db'],
  services: ['routes', 'db'],
  repositories: ['routes', 'services'],
  utils: ['routes', 'services', 'repositories', 'db', 'app'],
};

/** Что слой не должен использовать напрямую. */
const FORBIDDEN_PACKAGES = {
  routes: [],
  services: ['express'],
  repositories: ['express'],
  utils: ['express'],
  db: ['express'],
  config: ['express'],
};

/** Определяет слой модуля по его пути внутри server/. */
function layerOf(relativePath) {
  const parts = relativePath.split(path.sep);
  const first = parts[0];

  if (['routes', 'services', 'repositories', 'utils'].includes(first)) {
    return first;
  }

  if (parts.length === 1) {
    return path.basename(relativePath, '.js');
  }

  return null;
}

/** Собирает список всех js-файлов сервера. */
function collectJsFiles(dir) {
  const files = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectJsFiles(full));
    } else if (entry.name.endsWith('.js')) {
      files.push(full);
    }
  }

  return files;
}

/** Возвращает список импортируемых модулей (пути и пакеты). */
function parseImports(source) {
  const specifiers = [];
  const pattern = /(?:^|\n)\s*import\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;

  let match = pattern.exec(source);

  while (match !== null) {
    specifiers.push(match[1]);
    match = pattern.exec(source);
  }

  return specifiers;
}

/** Определяет, к какому слою ведёт относительный импорт. */
function resolveLayer(fromFile, specifier) {
  if (!specifier.startsWith('.')) {
    return { kind: 'package', name: specifier };
  }

  const resolved = path.resolve(path.dirname(fromFile), specifier);
  const relative = path.relative(serverDir, resolved);

  if (relative.startsWith('..')) {
    return { kind: 'outside', name: relative };
  }

  const layer = layerOf(relative);

  return layer
    ? { kind: 'layer', name: layer }
    : { kind: 'unknown', name: relative };
}

const files = collectJsFiles(serverDir);
const problems = [];
const edges = new Set();

console.log('Проверяем разделение на слои в server/…\n');

for (const file of files) {
  const relative = path.relative(serverDir, file);
  const layer = layerOf(relative);

  if (!layer) {
    continue;
  }

  const source = fs.readFileSync(file, 'utf8');

  for (const specifier of parseImports(source)) {
    const target = resolveLayer(file, specifier);

    if (target.kind === 'outside') {
      // Импорт из data/ или public/ — это допустимо (демо-данные).
      continue;
    }

    if (target.kind === 'package') {
      const forbidden = FORBIDDEN_PACKAGES[layer] ?? [];

      if (forbidden.includes(target.name)) {
        problems.push(
          `${relative}: слой «${layer}» не должен напрямую использовать пакет «${target.name}»`,
        );
      }

      continue;
    }

    if (target.kind === 'unknown') {
      continue;
    }

    edges.add(`${layer} → ${target.name}`);

    if (!(FORBIDDEN[layer] ?? []).includes(target.name)) {
      continue;
    }

    const allowed = ALLOWED[layer] ?? [];

    if (!allowed.includes(target.name)) {
      problems.push(
        `${relative}: слой «${layer}» импортирует «${target.name}» напрямую — это нарушает разделение слоёв`,
      );
    }
  }
}

console.log('Связи между слоями:');
for (const edge of [...edges].sort()) {
  console.log(`  ${edge}`);
}

console.log('\nПроверка запрещённых зависимостей:');
if (problems.length === 0) {
  console.log('  нарушений нет');
} else {
  for (const problem of problems) {
    console.log(`  ✗ ${problem}`);
  }
}

const expected = ['routes → services', 'services → repositories', 'repositories → db'];

console.log('\nОбязательные связи:');
for (const link of expected) {
  console.log(`  ${edges.has(link) ? '✓' : '✗'} ${link}`);
}

const missing = expected.filter((link) => !edges.has(link));

if (problems.length || missing.length) {
  console.log('\nИтог: разделение на слои нарушено.');
  process.exit(1);
}

console.log('\nИтог: разделение на три слоя соблюдено.');
