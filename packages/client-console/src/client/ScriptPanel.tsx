/**
 * The DolphinDB script console: a full-page main panel pairing a Monaco
 * editor with a bounded result pane. Monaco is bundled directly from the ESM
 * sources (the /plugins channel serves no static files) with donaco's
 * DolphinDB language — TextMate highlighting through the inlined onig.wasm,
 * function completion and signature help from the signature-slimmed docs.
 * ⌘/Ctrl+Enter or the Run button sends the buffer through the
 * dolphindbConsole.runScript Remote method, and the executor's row/byte
 * budgets bound what renders. The editor owns the text; the controller owns
 * only the last run's outcome.
 */

import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js'
import { loadWASM } from 'vscode-oniguruma'
import { register_dolphindb_language } from 'donaco'
import { Button, IconPlayOutline16, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { ScriptCell, ScriptConsoleFace, ScriptConsoleState } from './script-controller.ts'
import type {} from './slot-contract.ts'
import css from './ScriptPanel.module.css'

/** Props the renderer binds for the script console panel. */
export type ScriptPanelProps =
  PropsRuntime<'main'>
  & PropsLocale<'dolphindb.script'>
  & InjectFace<ScriptConsoleFace>

/** Locale reader for this panel's copy. */
type ScriptTranslate = TranslateNS<'dolphindb.script'>

/** donaco's language id for DolphinDB. */
const LANGUAGE_ID = 'dolphindb'

/** Read the app surface's brightness once so the editor theme matches it. */
function detectTheme(el: HTMLElement): 'light' | 'dark' {
  const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(getComputedStyle(el).backgroundColor)
  if (match === null) return 'light'
  const luminance = (0.2126 * Number(match[1]) + 0.7152 * Number(match[2]) + 0.0722 * Number(match[3])) / 255
  return luminance < 0.5 ? 'dark' : 'light'
}

/** Decode the inlined onig.wasm base64 for loadWASM. */
function onigBuffer(): ArrayBuffer {
  const binary = atob(__DONACO_ONIG_WASM_BASE64__)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return bytes.buffer
}

/**
 * The one-time language setup shared by every editor mount: oniguruma first
 * (the TextMate registry tokenizes through it), then donaco's providers. The
 * color map is fixed with the first mount's theme — donaco's registry holds
 * it globally, so a later theme switch does not re-tint the grammar.
 */
let languageReady: Promise<void> | undefined
function ensureDolphinDbLanguage(theme: 'light' | 'dark'): Promise<void> {
  languageReady ??= (async () => {
    await loadWASM(onigBuffer())
    await register_dolphindb_language(monaco, { docs: __DONACO_DOCS_SLIM__, theme })
  })()
  return languageReady
}

/** What the panel asks of the editor instance. */
interface EditorApi {
  /** The buffer's current text. */
  getDoc: () => string
}

/** The Monaco editing surface; mounts once, runs the buffer on Mod-Enter. */
function ScriptEditor({ apiRef, onRun, onReady }: {
  apiRef: { current: EditorApi | undefined }
  onRun: (script: string) => void
  onReady: (ready: boolean) => void
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const runRef = useRef(onRun)
  runRef.current = onRun
  const readyRef = useRef(onReady)
  readyRef.current = onReady

  useEffect(() => {
    const host = hostRef.current
    if (host === null) return
    let editor: monaco.editor.IStandaloneCodeEditor | undefined
    let cancelled = false
    const theme = detectTheme(host)
    void ensureDolphinDbLanguage(theme).then(() => {
      if (cancelled) return
      editor = monaco.editor.create(host, {
        value: '',
        language: LANGUAGE_ID,
        theme: theme === 'dark' ? 'vs-dark' : 'vs',
        fontSize: 13,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        minimap: { enabled: false },
        automaticLayout: true,
        fixedOverflowWidgets: true,
        scrollBeyondLastLine: false,
        tabSize: 4,
      })
      // Mod-Enter runs the buffer; scoped to the editor's focus, never a
      // window-level shortcut that would hijack other inputs.
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        runRef.current(editor?.getValue() ?? '')
      })
      apiRef.current = { getDoc: () => editor?.getValue() ?? '' }
      readyRef.current(true)
    }, (error: unknown) => {
      // A failed language setup surfaces through the console; the editor area
      // keeps its loading line rather than mounting a half-wired instance.
      console.error('dolphindb: monaco language setup failed', error)
    })
    return () => {
      cancelled = true
      apiRef.current = undefined
      editor?.dispose()
    }
    // Mount once per host.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div className={css.editor} ref={hostRef} />
}

/** Plain cell text; null renders as a dim NULL. */
function Cell({ cell }: { cell: ScriptCell }) {
  if (cell === null || cell === undefined) return <span className={css.nullCell}>NULL</span>
  const text = typeof cell === 'object' ? JSON.stringify(cell) : String(cell)
  return <>{text === '' ? ' ' : text}</>
}

/** The run outcome: idle hint, error banner, executed note, or the result grid. */
function ResultPane({ t, state }: { t: ScriptTranslate, state: ScriptConsoleState }) {
  const run = state.run
  if (run.status === 'idle') {
    return (
      <div className={clsx(css.resultCard, css.center)}>
        <p className={css.hint} role="status">{t('resultIdle')}</p>
      </div>
    )
  }
  return (
    <div className={css.resultCard}>
      {run.status === 'error' && (
        <p className={css.errorBanner} role="alert">
          <span className={css.errorTitle}>{t('failed')}</span>
          <span className={css.errorMessage}>{run.errorMessage}</span>
        </p>
      )}
      {run.status === 'ready' && run.executed && (
        <p className={css.okBanner} role="status">{t('executed', { ms: run.elapsedMs ?? 0 })}</p>
      )}
      {run.status === 'ready' && !run.executed && (
        <>
          <div className={css.resultMeta}>
            <Tag tone="neutral">{t('rowCount', { count: run.rowCount })}</Tag>
            {run.server !== undefined && <span>{`${t('server')}: ${run.server}`}</span>}
            {run.elapsedMs !== undefined && <span>{t('elapsed', { ms: run.elapsedMs })}</span>}
          </div>
          {run.truncated && (
            <p className={css.hint} role="status">{t('truncatedResult', { count: run.rows.length })}</p>
          )}
          <div className={css.gridWrap}>
            <table className={css.table}>
              <thead>
                <tr>
                  {run.columns.map(column => <th key={column}>{column}</th>)}
                </tr>
              </thead>
              <tbody>
                {run.rows.map((row, index) => (
                  <tr key={index}>
                    {run.columns.map((column, cellIndex) => (
                      <td key={column} className={css.mono}>
                        <Cell cell={row[cellIndex] ?? null} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {run.status === 'running' && (
        <p className={css.hint} role="status">{t('running')}</p>
      )}
    </div>
  )
}

/**
 * Render the script console panel.
 * @param props - locale copy, the console snapshot, and its action.
 * @returns the panel tree.
 */
export function ScriptPanel(props: ScriptPanelProps) {
  const { t } = props
  const state = props.useScriptConsole(snapshot => snapshot)
  const [editorReady, setEditorReady] = useState(false)
  const editorApi = useRef<EditorApi | undefined>(undefined)
  const runBuffer = (): void => {
    const doc = editorApi.current?.getDoc()
    if (doc !== undefined) props.runScript(doc)
  }
  return (
    <div className={css.root}>
      <header className={css.header}>
        <div className={css.headText}>
          <div className={css.titleRow}>
            <h1 className={css.title}>{t('title')}</h1>
          </div>
        </div>
      </header>
      <div className={css.editorCard}>
        <div className={css.editorWrap}>
          <ScriptEditor apiRef={editorApi} onRun={props.runScript} onReady={setEditorReady} />
          {!editorReady && <p className={css.editorLoading} role="status">{t('editorLoading')}</p>}
        </div>
        <div className={css.editorBar}>
          <span className={css.hint}>{t('runHint')}</span>
          <Button
            variant="primary"
            size="sm"
            icon={<IconPlayOutline16 size={13} />}
            disabled={!editorReady || state.run.status === 'running'}
            onClick={runBuffer}
          >
            {state.run.status === 'running' ? t('running') : t('run')}
          </Button>
        </div>
      </div>
      <ResultPane t={t} state={state} />
    </div>
  )
}
