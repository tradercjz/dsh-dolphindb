/**
 * Package-local replica of the harness's unpublished `clientBundle` tsdown
 * preset (packages/client/tsdown.client.ts in deepseek-harness). Two configs:
 * the node-half library (lib/index.js, esm, from the tsc output) and the
 * browser client bundle (lib/client.js, cjs) that hands itself to
 * window.__ModuleLoader__.load({ id, factory }) and resolves the shell's
 * baseline module-table rows through the injected require. `.module.css`
 * imports compile through lightningcss: the hashed class map is the module
 * default export and a tagged style is injected at factory execution. Monaco's
 * plain `.css` imports take the same injection path with an empty class map.
 *
 * The /plugins channel serves exactly one bundle per client package — no
 * static side files — so Monaco's runtime resources are inlined at build
 * time, the same answer the harness gives for PDF.js: vscode-oniguruma's
 * onig.wasm as base64 (the TextMate grammar engine donaco highlights
 * through) and the DolphinDB function docs reduced to signatures (completion
 * and signature help keep working; hover markdown is the deliberate
 * trade-off, the full docs.en.json is 5.4MB of locale-specific prose).
 */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename, dirname, join as joinPath, resolve as resolvePath } from 'node:path'
import type { UserConfig } from 'tsdown'
import { transform } from 'lightningcss'

/** Plugin id stamped into the __ModuleLoader__.load handoff and the style tags. */
const ID = '@tradercjz/dsh-client-console'

const require = createRequire(import.meta.url)

/** onig.wasm, inlined as base64 (see module doc; the bundle has no static channel). */
const ONIG_WASM_BASE64 = readFileSync(
  joinPath(dirname(require.resolve('vscode-oniguruma/package.json')), 'release', 'onig.wasm'),
).toString('base64')

/**
 * The DolphinDB function docs reduced to the locale-independent half every
 * locale shares: per-function signatures. Hover markdown is dropped on
 * purpose (see module doc); the shape still satisfies donaco's DocsProvider.
 */
const DONACO_DOCS_SLIM: Record<string, { url: string, signatures: unknown, markdown: string }> = {}
for (const [name, entry] of Object.entries(
  JSON.parse(readFileSync(require.resolve('dolphindb/docs.en.json'), 'utf8')) as Record<string, { signatures?: unknown }>,
)) {
  DONACO_DOCS_SLIM[name] = { url: '', signatures: entry.signatures ?? null, markdown: '' }
}

/**
 * The shell's baseline module table (packages/client/web/src/platform.ts):
 * every dynamic bundle requests these rows instead of carrying private copies.
 * Anything outside the set must inline — a require() the table cannot answer
 * is a guaranteed runtime throw.
 */
const CLIENT_EXTERNALS: ReadonlySet<string> = new Set([
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
])

/**
 * Virtual-id wrapper keeping module CSS away from tsdown's own css pipeline.
 * The suffix matters: tsdown's guard matches ids ending in `.css`.
 */
const CSS_VIRTUAL_PREFIX = '\0dsh-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'

/** Emit one plugin-owned style injector and the CSS Modules class map. */
function styleInjectionModule(
  id: string,
  fileId: string,
  css: string,
  classMap: Readonly<Record<string, string>>,
): string {
  return [
    `const css = ${JSON.stringify(css)};`,
    `const tagId = ${JSON.stringify(`${id}/${basename(fileId)}`)};`,
    'if (typeof document !== \'undefined\' && document.querySelector(\'style[data-plugin-css=\' + JSON.stringify(tagId) + \']\') === null) {',
    '  const tag = document.createElement(\'style\');',
    `  tag.dataset.plugin = ${JSON.stringify(id)};`,
    '  tag.dataset.pluginCss = tagId;',
    '  tag.textContent = css;',
    '  document.head.appendChild(tag);',
    '}',
    `export default ${JSON.stringify(classMap)};`,
  ].join('\n')
}

export default [
  {
    // The node half exists so the plugin appears in the host cordis.yml /
    // Loader; tsc has already type-checked and emitted it under lib/types.
    name: ID,
    entry: ['lib/types/index.js'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
  },
  {
    name: `${ID}/client`,
    entry: { client: 'src/client/index.ts' },
    // clean must stay off: a default clean would wipe the node-half output
    // emitted by the config above.
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2024',
    dts: false,
    // Plugin code is fetched outside Vite's module graph, so its own bundle
    // must carry the TS/TSX mapping consumed by browser profiling tools.
    sourcemap: true,
    clean: false,
    deps: {
      neverBundle: (specifier: string) => CLIENT_EXTERNALS.has(specifier),
      alwaysBundle: (specifier: string) => !CLIENT_EXTERNALS.has(specifier),
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
      __DONACO_ONIG_WASM_BASE64__: JSON.stringify(ONIG_WASM_BASE64),
      __DONACO_DOCS_SLIM__: JSON.stringify(DONACO_DOCS_SLIM),
    },
    plugins: [{
      // Bundle purity gate (the build-time mirror of the module-edge rules):
      // baseline rows stay external, every other @deepseek-ai value import is
      // a build error — cross-plugin collaboration goes through cordis
      // services (type-only imports are erased and never reach this gate).
      name: 'dsh-client-bundle-purity',
      resolveId(source: string) {
        if (!source.startsWith('@deepseek-ai/')) return null
        if (CLIENT_EXTERNALS.has(source)) return null
        throw new Error(
          `client bundle purity: "${source}" is not in the default client externals — `
          + 'cross-plugin value imports are forbidden; collaborate through cordis services '
          + '(type-only imports are erased and never reach this gate)',
        )
      },
    }, {
      name: 'dsh-css-modules-inline',
      resolveId(source: string, importer: string | undefined) {
        if (!source.endsWith('.css') || importer === undefined) return null
        return CSS_VIRTUAL_PREFIX + resolvePath(dirname(importer), source) + CSS_VIRTUAL_SUFFIX
      },
      async load(virtualId: string) {
        if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
        const fileId = virtualId.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
        // The virtual id otherwise hides the physical stylesheet from Rolldown's watch graph.
        this.addWatchFile(fileId)
        const source = await readFile(fileId)
        // Plain stylesheets (Monaco's feature css) inject as-is; only
        // .module.css compiles a hashed class map.
        const isModule = fileId.endsWith('.module.css')
        const { code, exports: cssExports } = transform({
          filename: fileId,
          code: source,
          cssModules: isModule ? { pattern: '[hash]_[local]' } : false,
          minify: true,
        })
        const classMap: Record<string, string> = {}
        const exportEntries = Object.entries(cssExports ?? {})
          .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        for (const [local, exp] of exportEntries) classMap[local] = exp.name
        return styleInjectionModule(ID, fileId, code.toString(), classMap)
      },
    }],
    outputOptions: {
      entryFileNames: 'client.js',
      sourcemapExcludeSources: false,
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
] satisfies UserConfig[]
