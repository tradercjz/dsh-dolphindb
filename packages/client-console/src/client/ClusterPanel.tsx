/**
 * The DolphinDB cluster console: a full-page main panel. The header names
 * the deployment the introspection ran on (server, node alias, controller),
 * the toolbar starts/stops the checked data/compute nodes behind a confirm
 * dialog, and the table is the bounded getClusterPerf projection — columns
 * indexed by name so a deployment missing a column renders a dash rather
 * than shifting cells. All data and callbacks arrive through the props
 * shares; the controller owns polling, selection, and every wire call.
 */

import { useState } from 'react'
import clsx from 'clsx'
import {
  Button, fileSizeText, IconRefreshOutline14, Modal, StateDot, Tag,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { ClusterOverview } from '@tradercjz/dsh-dolphindb/console'
import {
  nodeName, nodeOperable, perfCell, perfMode,
  type ClusterConsoleFace, type ClusterConsoleState, type ClusterPerfCell, type ClusterPerfRow,
} from './controller.ts'
import type {} from './slot-contract.ts'
import css from './ClusterPanel.module.css'

/** Props the renderer binds for the cluster console panel. */
export type ClusterPanelProps =
  PropsRuntime<'main'>
  & PropsLocale<'dolphindb.console'>
  & InjectFace<ClusterConsoleFace>

/** Locale reader for this panel's copy. */
type ConsoleTranslate = TranslateNS<'dolphindb.console'>

/** Rendered placeholder for an absent column or unparsable cell. */
const EMPTY_CELL = '—'

/** One perf row projected into display strings. */
interface NodeRowView {
  /** React key: the alias, or the row index when the name column is absent. */
  key: string
  /** Node alias (empty when the deployment's table lacks the name column). */
  name: string
  /** Whether the controller accepts start/stop for this row (mode 0/4). */
  operable: boolean
  /** Raw mode value; undefined when absent or not numeric. */
  mode: number | undefined
  /** true online, false offline, undefined unknown/absent. */
  online: boolean | undefined
  /** Raw state value for the unknown-state label. */
  stateValue: number | undefined
  site: string
  cpu: string
  load: string
  memory: string
  jobs: string
  tasks: string
}

/** Plain cell text; EMPTY_CELL for missing values. */
function cellText(cell: ClusterPerfCell | undefined): string {
  if (cell === undefined || cell === null) return EMPTY_CELL
  const text = String(cell)
  return text === '' ? EMPTY_CELL : text
}

/** Numeric cell with light trimming; EMPTY_CELL when not numeric. */
function numberText(cell: ClusterPerfCell | undefined): string {
  const value = Number(cell)
  if (!Number.isFinite(value)) return EMPTY_CELL
  return String(Math.round(value * 10) / 10)
}

/** Byte-count cell (string-carried bigint); EMPTY_CELL when not numeric. */
function bytesText(cell: ClusterPerfCell | undefined): string {
  const value = Number(cell)
  return Number.isFinite(value) ? fileSizeText(value) : EMPTY_CELL
}

/** getClusterPerf's maxMemSize is a GB count, not a byte count. */
function gbText(cell: ClusterPerfCell | undefined): string {
  const value = Number(cell)
  return Number.isFinite(value) ? `${value}GB` : EMPTY_CELL
}

/** Project one raw perf row into its display shape. */
function projectRow(overview: ClusterOverview, row: ClusterPerfRow, index: number): NodeRowView {
  const name = nodeName(overview, row)
  const stateValue = Number(perfCell(overview, row, 'state'))
  const stateKnown = Number.isFinite(stateValue)
  const used = perfCell(overview, row, 'memoryUsed')
  const max = perfCell(overview, row, 'maxMemSize')
  const cpu = numberText(perfCell(overview, row, 'cpuUsage'))
  const runningJobs = cellText(perfCell(overview, row, 'runningJobs'))
  const queuedJobs = cellText(perfCell(overview, row, 'queuedJobs'))
  const runningTasks = cellText(perfCell(overview, row, 'runningTasks'))
  const queuedTasks = cellText(perfCell(overview, row, 'queuedTasks'))
  return {
    key: name === '' ? String(index) : name,
    name,
    operable: nodeOperable(overview, row),
    mode: perfMode(overview, row),
    online: stateKnown ? stateValue === 1 : undefined,
    stateValue: stateKnown ? stateValue : undefined,
    site: cellText(perfCell(overview, row, 'site')),
    cpu: cpu === EMPTY_CELL ? EMPTY_CELL : `${cpu}%`,
    load: numberText(perfCell(overview, row, 'avgLoad')),
    memory: `${bytesText(used)} / ${gbText(max)}`,
    jobs: `${runningJobs} / ${queuedJobs}`,
    tasks: `${runningTasks} / ${queuedTasks}`,
  }
}

/** Role badge copy and tone for one mode value. */
function roleBadge(t: ConsoleTranslate, mode: number | undefined): { text: string; tone: 'info' | 'neutral' | 'warning' | 'success' | 'quiet' } {
  switch (mode) {
    case 0: return { text: t('roleData'), tone: 'info' }
    case 1: return { text: t('roleAgent'), tone: 'neutral' }
    case 2: return { text: t('roleController'), tone: 'warning' }
    case 3: return { text: t('roleSingle'), tone: 'neutral' }
    case 4: return { text: t('roleComputing'), tone: 'success' }
    default: return { text: t('roleUnknown', { mode: mode ?? EMPTY_CELL }), tone: 'quiet' }
  }
}

/** The header's deployment identity block. */
function Header({ t, state, onRefresh }: {
  t: ConsoleTranslate
  state: ClusterConsoleState
  onRefresh: () => void
}) {
  const overview = state.overview
  return (
    <header className={css.header}>
      <div className={css.headText}>
        <div className={css.titleRow}>
          <h1 className={css.title}>{t('title')}</h1>
          {overview !== undefined && (
            <Tag tone={overview.clustered ? 'info' : 'neutral'}>
              {t(overview.clustered ? 'badgeCluster' : 'badgeSingle')}
            </Tag>
          )}
        </div>
        {overview !== undefined && (
          <div className={css.meta}>
            <span>{`${t('server')}: ${overview.server}`}</span>
            <span>{`${t('node')}: ${overview.nodeAlias}`}</span>
            {overview.controllerAlias !== null && (
              <span>{`${t('controller')}: ${overview.controllerAlias}`}</span>
            )}
          </div>
        )}
      </div>
      <div className={css.headActions}>
        {state.updatedAt !== undefined && (
          <span className={css.updated}>
            {t('lastRefreshed', { time: new Date(state.updatedAt).toLocaleTimeString() })}
          </span>
        )}
        <Button
          variant="outline"
          size="sm"
          icon={<IconRefreshOutline14 size={14} />}
          disabled={state.status === 'loading'}
          onClick={onRefresh}
        >
          {t('refresh')}
        </Button>
      </div>
    </header>
  )
}

/**
 * Render the cluster console panel.
 * @param props - locale copy, the console snapshot, and its actions.
 * @returns the panel tree.
 */
export function ClusterPanel(props: ClusterPanelProps) {
  const { t } = props
  const state = props.useClusterConsole(snapshot => snapshot)
  const [pending, setPending] = useState<'start' | 'stop' | undefined>(undefined)
  const overview = state.overview
  const clustered = overview?.clustered ?? false
  const operableSelection = overview === undefined ? [] : state.selected.filter(name =>
    overview.rows.some(row => nodeOperable(overview, row) && nodeName(overview, row) === name))
  const confirmPending = (): void => {
    if (pending === 'start') props.startSelected()
    if (pending === 'stop') props.stopSelected()
    setPending(undefined)
  }
  return (
    <div className={css.root}>
      <Header t={t} state={state} onRefresh={props.refresh} />
      {state.status === 'error' && overview === undefined
        ? (
          <div className={css.center}>
            <p className={css.errorText} role="alert">
              {t('loadFailed')}{state.errorMessage === undefined ? '' : ` ${state.errorMessage}`}
            </p>
            <Button variant="outline" size="sm" onClick={props.refresh}>{t('retry')}</Button>
          </div>
        )
        : (
          <div className={css.body}>
            {state.errorMessage !== undefined && (
              <p className={css.banner} role="alert">{t('refreshFailed', { message: state.errorMessage })}</p>
            )}
            {state.receipt !== undefined && (
              <p className={clsx(css.banner, state.receipt.ok ? css.bannerOk : css.bannerFailed)} role="status">
                {state.receipt.ok
                  ? t(state.receipt.kind === 'start' ? 'startAccepted' : 'stopAccepted', {
                    count: state.receipt.result.nodes.length,
                    elapsed: state.receipt.result.elapsedMs,
                  })
                  : t('actionFailed', { message: state.receipt.message })}
              </p>
            )}
            {overview !== undefined && !clustered && (
              <p className={css.hint} role="status">{t('singleNodeHint')}</p>
            )}
            {overview !== undefined && clustered && (
              <div className={css.toolbar}>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={state.operating || operableSelection.length === 0}
                  onClick={() => { setPending('start') }}
                >
                  {t('startSelected')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={state.operating || operableSelection.length === 0}
                  onClick={() => { setPending('stop') }}
                >
                  {t('stopSelected')}
                </Button>
                <span className={css.selection}>
                  {t('selectedCount', { count: operableSelection.length })}
                </span>
                <button
                  type="button"
                  className={css.clearSelection}
                  disabled={state.selected.length === 0}
                  onClick={props.clearSelection}
                >
                  {t('clearSelection')}
                </button>
                {state.operating && <span className={css.operating} role="status">{t('operating')}</span>}
              </div>
            )}
            {overview === undefined
              ? <p className={css.hint} role="status">{t('loading')}</p>
              : (
                <div className={css.tableWrap}>
                  <table className={css.table}>
                    <thead>
                      <tr>
                        <th className={css.checkCol} aria-label={t('selectedCount', { count: '' })} />
                        <th>{t('colName')}</th>
                        <th>{t('colRole')}</th>
                        <th>{t('colState')}</th>
                        <th>{t('colSite')}</th>
                        <th>{t('colCpu')}</th>
                        <th>{t('colLoad')}</th>
                        <th>{t('colMemory')}</th>
                        <th>{t('colJobs')}</th>
                        <th>{t('colTasks')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.rows.map((row, index) => {
                        const view = projectRow(overview, row, index)
                        const badge = roleBadge(t, view.mode)
                        return (
                          <tr key={view.key}>
                            <td className={css.checkCol}>
                              <input
                                type="checkbox"
                                className={css.check}
                                aria-label={view.name}
                                checked={view.operable && state.selected.includes(view.name)}
                                disabled={!view.operable || state.operating}
                                onChange={() => { props.toggleSelect(view.name) }}
                              />
                            </td>
                            <td className={css.nameCol}>{view.name === '' ? EMPTY_CELL : view.name}</td>
                            <td><Tag tone={badge.tone}>{badge.text}</Tag></td>
                            <td>
                              <span className={css.stateCell}>
                                <StateDot state={view.online === undefined ? 'idle' : view.online ? 'done' : 'idle'} size={8} />
                                {view.online === undefined
                                  ? t('stateUnknown', { state: view.stateValue ?? EMPTY_CELL })
                                  : t(view.online ? 'stateOnline' : 'stateOffline')}
                              </span>
                            </td>
                            <td className={css.mono}>{view.site}</td>
                            <td className={css.num}>{view.cpu}</td>
                            <td className={css.num}>{view.load}</td>
                            <td className={css.num}>{view.memory}</td>
                            <td className={css.num}>{view.jobs}</td>
                            <td className={css.num}>{view.tasks}</td>
                          </tr>
                        )
                      })}
                      {overview.rows.length === 0 && (
                        <tr>
                          <td className={css.emptyRow} colSpan={10}>{t('emptyNodes')}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
          </div>
        )}
      <Modal
        open={pending !== undefined}
        onClose={() => { setPending(undefined) }}
        title={t(pending === 'stop' ? 'confirmStopTitle' : 'confirmStartTitle')}
        closeLabel={t('close')}
        footer={(
          <>
            <Button variant="ghost" size="sm" onClick={() => { setPending(undefined) }}>{t('cancel')}</Button>
            <Button variant="primary" size="sm" onClick={confirmPending}>{t('confirm')}</Button>
          </>
        )}
      >
        <p className={css.confirmText}>
          {t(pending === 'stop' ? 'confirmStopBody' : 'confirmStartBody', { count: operableSelection.length })}
        </p>
        <ul className={css.confirmList}>
          {operableSelection.map(name => <li key={name} className={css.mono}>{name}</li>)}
        </ul>
      </Modal>
    </div>
  )
}
