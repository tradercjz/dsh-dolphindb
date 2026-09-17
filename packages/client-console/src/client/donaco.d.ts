/**
 * Local facades for the pieces that arrive without types:
 * - donaco ships no declaration files even though its exports map names them.
 * - the two build-time assets tsdown defines inline into the bundle (the
 *   /plugins channel serves no static side files, so onig.wasm and the
 *   signature-slimmed DolphinDB docs travel as literals).
 */
declare module 'donaco' {
  import type * as Monaco from 'monaco-editor/esm/vs/editor/editor.api.js'
  import type { Docs } from 'dolphindb/docs.js'

  /** Register the DolphinDB language (tokenizer, completion, hover, signature help) on a monaco instance. */
  export function register_dolphindb_language(
    monaco: typeof Monaco,
    options: { docs: Docs, theme?: 'light' | 'dark' },
  ): Promise<void>
}

/** base64 of vscode-oniguruma's onig.wasm, defined by tsdown.config.ts. */
declare const __DONACO_ONIG_WASM_BASE64__: string

/** The DolphinDB function docs reduced to signatures, defined by tsdown.config.ts. */
declare const __DONACO_DOCS_SLIM__: import('dolphindb/docs.js').Docs
