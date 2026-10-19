import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => readFileSync(path.join(root, name), 'utf8');

function typecheck(sources) {
  const files = new Map(Object.entries(sources).map(([name, source]) => [path.join(root, 'tests', name), source]));
  const options = {
    strict: true,
    skipLibCheck: true,
    noEmit: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true,
    baseUrl: root,
    paths: {
      '@/*': ['src/*'],
      '@server': ['service/runtime/sdk/server'],
      '@server/response': ['service/runtime/sdk/response'],
      '@server/types': ['service/runtime/sdk/types'],
    },
  };
  const host = ts.createCompilerHost(options);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (name, languageVersion, ...args) => files.has(name)
    ? ts.createSourceFile(name, files.get(name), languageVersion, true)
    : getSourceFile(name, languageVersion, ...args);
  const program = ts.createProgram([...files.keys(), path.join(root, 'src/global.d.ts')], options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCurrentDirectory: () => root,
    getCanonicalFileName: (name) => name,
    getNewLine: () => '\n',
  }));
}

test('API documents are directly readable and have a reachable local index', () => {
  const index = read('docs/README.md');
  assert.match(read('AGENTS.md'), /docs\/README\.md/);
  for (const name of readdirSync(path.join(root, 'docs')).filter((name) => name.endsWith('.md'))) {
    const content = read(`docs/${name}`);
    assert.doesNotMatch(content, /\{%|\{#|\{\{workspace\}\}|ApiDocsLookup|API_DOCS_LOOKUP/, name);
    if (name.startsWith('API_')) assert.ok(index.includes(`(${name})`), `Missing API index entry: ${name}`);
    for (const [, link] of content.matchAll(/\]\(([^)\s]+)\)/g)) {
      if (link.startsWith('#') || /^[a-z]+:/i.test(link)) continue;
      const target = decodeURIComponent(link.split('#')[0]);
      assert.ok(existsSync(path.resolve(root, 'docs', target)), `${name}: missing ${link}`);
    }
  }
});

test('frontend API declarations cover implemented calls and reject invalid contracts', () => {
  typecheck({
    'frontend-contract.ts': `
      const music: Promise<{ url: string; duration?: number }> = window.lingguang.ai.musicGeneration({
        prompt: 'ambient piano', lyrics: '', duration: 30,
      });
      const vibration: Promise<unknown> = window.lingguang.vibrate({ mode: 'short' });
      window.lingguang.data.getStockCandlestickData({ symbol: '600519.SH', period: '1d', range: '1y' });
      window.lingguang.data.getStockCandlestickData({ symbol: '600519.SH', lookback: '最近1年' });
      window.lingguang.gyroscope.start({ onReading: (reading) => { const x: number = reading.x; } });
      // @ts-expect-error the implemented gyroscope API requires onReading
      window.lingguang.gyroscope.start();
      // @ts-expect-error options cannot omit onReading
      window.lingguang.gyroscope.start({ frequency: 'high' });
      declare const write: DbExecuteResult;
      // @ts-expect-error the platform does not return auto-increment IDs
      write.data.lastInsertId;
      export {};
    `,
    'backend-contract.ts': `
      import { db } from '@server';
      const result = db.query<{ id: string }>({ sql: 'SELECT id FROM notes LIMIT ?', binds: [10] });
      const id: string | undefined = result.data?.[0]?.id;
      // @ts-expect-error the selected row shape is preserved
      const wrongId: number | undefined = result.data?.[0]?.id;
    `,
  });
});

test('complete frontend and controller examples compile against the shipped SDK', () => {
  const documents = [
    'API_DB', 'API_DB_SERVICE', 'API_WEBSEARCH_SERVICE', 'API_DATAFETCH',
    'API_AGENTIC_DATAFETCH', 'API_STORAGE', 'API_GET_USER_MEDIA', 'API_MUSICGEN',
    'API_AUDIOCONTEXT2', 'API_SOUND_LIB',
  ];
  const sources = {};
  for (const name of documents) {
    const blocks = [...read(`docs/${name}.md`).matchAll(/```(tsx?)\n([\s\S]*?)```/g)];
    assert.ok(blocks.length > 0, `${name}: no executable example`);
    blocks.forEach(([, language, source], index) => {
      sources[`${name}-${index}.${language}`] = `${source}\nexport {};\n`;
    });
  }
  typecheck(sources);
});

test('Service DB forwards the original payload and result without changing the host protocol', () => {
  const source = read('service/runtime/sdk/server.ts');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const calls = [];
  const result = { success: true, data: [{ id: 'note-1' }] };
  const sandbox = {
    exports: {},
    __quickjsHostCall: (method, params) => {
      calls.push({ method, params });
      return result;
    },
  };
  runInNewContext(compiled, sandbox);
  const params = { sql: 'SELECT id FROM notes LIMIT ?', binds: [10] };
  assert.equal(sandbox.exports.db.query(params), result);
  assert.deepEqual(calls, [{ method: 'db.query', params }]);
});
