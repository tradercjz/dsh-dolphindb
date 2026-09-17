/**
 * The DolphinDB script console: a full-page main panel pairing a CodeMirror
 * editor with a bounded result pane. CodeMirror is bundled directly (no
 * workers, no loader) with SQL highlighting and keyword completion as the
 * DolphinDB-adjacent grammar; ⌘/Ctrl+Enter or the Run button sends the
 * buffer through the dolphindbConsole.runScript Remote method, and the
 * executor's row/byte budgets bound what renders. The editor owns the text;
 * the controller owns only the last run's outcome.
 */

import { useEffect, useRef } from 'react'
import clsx from 'clsx'
import { Compartment, EditorState } from '@codemirror/state'
import { EditorView, keymap, placeholder } from '@codemirror/view'
import { sql } from '@codemirror/lang-sql'
import { basicSetup } from 'codemirror'
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

/** Editor colors track the app's own design tokens, so theme switches come along for free. */
const consoleTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--dsw-alias-bg-layer-3)',
    color: 'var(--dsw-alias-label-primary)',
    fontSize: '13px',
    height: '100%',
  },
  '.cm-content': {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    caretColor: 'var(--dsw-alias-label-primary)',
    padding: '10px 0',
  },
  '.cm-line': { padding: '0 12px' },
  '.cm-gutters': {
    backgroundColor: 'var(--dsw-alias-bg-layer-3)',
    color: 'var(--dsw-alias-label-quaternary)',
    border: 'none',
    paddingLeft: '6px',
  },
  '.cm-activeLine': { backgroundColor: 'var(--dsw-alias-bg-layer-2)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--dsw-alias-bg-layer-2)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'var(--dsw-alias-brand-primary-dim, rgba(88, 128, 255, 0.28))',
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--dsw-alias-bg-layer-2)',
    color: 'var(--dsw-alias-label-primary)',
    border: '0.5px solid var(--dsw-alias-border-l2)',
  },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    backgroundColor: 'var(--dsw-alias-brand-primary)',
    color: 'var(--dsw-alias-label-on-brand, #fff)',
  },
})

/** What the panel asks of the editor instance. */
interface EditorApi {
  /** The buffer's current text. */
  getDoc: () => string
}

/** The CodeMirror editing surface; mounts once, placeholder reconfigures on locale change. */
function ScriptEditor({ placeholderText, apiRef, onRun }: {
  placeholderText: string
  apiRef: { current: EditorApi | undefined }
  onRun: (script: string) => void
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | undefined>(undefined)
  const placeholderCompartment = useRef(new Compartment())
  const runRef = useRef(onRun)
  runRef.current = onRun

  useEffect(() => {
    const host = hostRef.current
    if (host === null) return
    const view = new EditorView({
      state: EditorState.create({
        doc: '',
        extensions: [
          basicSetup,
          sql(),
          consoleTheme,
          placeholderCompartment.current.of(placeholder(placeholderText)),
          // Mod-Enter runs the buffer; scoped to the editor's focus, never a
          // window-level shortcut that would hijack other inputs.
          keymap.of([{
            key: 'Mod-Enter',
            run: (target) => {
              runRef.current(target.state.doc.toString())
              return true
            },
          }]),
        ],
      }),
      parent: host,
    })
    viewRef.current = view
    apiRef.current = { getDoc: () => view.state.doc.toString() }
    return () => {
      apiRef.current = undefined
      viewRef.current = undefined
      view.destroy()
    }
    // Mount once per host; the placeholder reconfigures through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: placeholderCompartment.current.reconfigure(placeholder(placeholderText)),
    })
  }, [placeholderText])

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
        <ScriptEditor placeholderText={t('editorPlaceholder')} apiRef={editorApi} onRun={props.runScript} />
        <div className={css.editorBar}>
          <span className={css.hint}>{t('runHint')}</span>
          <Button
            variant="primary"
            size="sm"
            icon={<IconPlayOutline16 size={13} />}
            disabled={state.run.status === 'running'}
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
