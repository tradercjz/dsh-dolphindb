/** Locale bundles for the DolphinDB script console panel. */

/** Locale keys the panel renders. */
export type ScriptConsoleLocaleKey =
  | 'panelLabel' | 'title'
  | 'run' | 'running' | 'runHint' | 'editorPlaceholder'
  | 'resultIdle' | 'executed' | 'failed' | 'truncatedResult'
  | 'rowCount' | 'elapsed' | 'server'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** This panel's own copy namespace. */
    'dolphindb.script': ScriptConsoleLocaleKey
  }
}

/** English copy. */
export const en: Record<ScriptConsoleLocaleKey, string> = {
  panelLabel: 'Script',
  title: 'DolphinDB Script Console',
  run: 'Run',
  running: 'Running…',
  runHint: '⌘/Ctrl + Enter',
  editorPlaceholder: 'Write a DolphinDB script or SQL here…',
  resultIdle: 'Run a script and the result lands here.',
  executed: 'Done — the script returned no value ({ms} ms).',
  failed: 'The run failed:',
  truncatedResult: 'The executor budget truncated this result ({count} rows kept).',
  rowCount: '{count} rows',
  elapsed: '{ms} ms',
  server: 'Server',
}

/** Simplified Chinese copy. */
export const zh: Record<ScriptConsoleLocaleKey, string> = {
  panelLabel: '脚本',
  title: 'DolphinDB 脚本控制台',
  run: '执行',
  running: '正在执行…',
  runHint: '⌘/Ctrl + Enter',
  editorPlaceholder: '在此输入 DolphinDB 脚本或 SQL…',
  resultIdle: '执行脚本后，结果显示在这里。',
  executed: '执行完成——脚本没有返回值（{ms} ms）。',
  failed: '执行失败：',
  truncatedResult: '结果被执行器预算截断（保留 {count} 行）。',
  rowCount: '{count} 行',
  elapsed: '{ms} ms',
  server: '服务器',
}
