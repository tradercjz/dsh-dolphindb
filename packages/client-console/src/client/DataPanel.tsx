/**
 * The DolphinDB data browser: a full-page main panel split into a DFS
 * database tree and a table content pane. The tree is the sorted catalog
 * with lazy expansion and a text filter; the content pane renders the
 * selected table's schema-informed grid — columns ordered by colDefs, types
 * as header subtitles — plus a bounded page window with prev/next, page
 * size, and reload. All data and callbacks arrive through the props shares;
 * the controller owns loading, staleness, and every wire call.
 */

import { useState } from 'react'
import clsx from 'clsx'
import {
  Button, IconChevronRightOutline14, IconRefreshOutline14, Tag,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import {
  orderColumns, PAGE_SIZES, tableDb, tableName,
  type DataBrowserFace, type DataBrowserState, type DataCell, type DataRow,
} from './data-controller.ts'
import type {} from './slot-contract.ts'
import css from './DataPanel.module.css'

/** Props the renderer binds for the data browser panel. */
export type DataPanelProps =
  PropsRuntime<'main'>
  & PropsLocale<'dolphindb.data'>
  & InjectFace<DataBrowserFace>

/** Locale reader for this panel's copy. */
type DataTranslate = TranslateNS<'dolphindb.data'>

/** The dfs:// scheme prefix every catalog path carries. */
const DFS_PREFIX = 'dfs://'

/** Display name of a database path. */
function dbLabel(path: string): string {
  return path.startsWith(DFS_PREFIX) ? path.slice(DFS_PREFIX.length) : path
}

/** One schema column projected for the grid header. */
interface ColumnView {
  readonly name: string
  readonly type: string | undefined
}

/** Read the schema's colDefs rows as (name, typeString) pairs, indexed by column name. */
function schemaColumns(state: DataBrowserState): ColumnView[] {
  const { columns, rows } = state.schema
  const nameIndex = columns.indexOf('name')
  const typeIndex = columns.indexOf('typeString')
  if (nameIndex < 0) return []
  return rows.map(row => ({
    name: String(row[nameIndex] ?? ''),
    type: typeIndex < 0 || row[typeIndex] === null ? undefined : String(row[typeIndex]),
  })).filter(column => column.name !== '')
}

/** Grid columns: schema order where known, result extras trailing. */
function gridColumns(state: DataBrowserState): ColumnView[] {
  const schema = schemaColumns(state)
  const ordered = orderColumns(schema.map(column => column.name), state.page.columns)
  const types = new Map(schema.map(column => [column.name, column.type]))
  return ordered.map(name => ({ name, type: types.get(name) }))
}

/** Plain cell text; null renders as a dim NULL. */
function Cell({ cell }: { cell: DataCell }) {
  if (cell === null || cell === undefined) return <span className={css.nullCell}>NULL</span>
  const text = String(cell)
  return <>{text === '' ? ' ' : text}</>
}

/** The header's server identity and catalog refresh. */
function Header({ t, state, onRefresh }: {
  t: DataTranslate
  state: DataBrowserState
  onRefresh: () => void
}) {
  return (
    <header className={css.header}>
      <div className={css.headText}>
        <div className={css.titleRow}>
          <h1 className={css.title}>{t('title')}</h1>
        </div>
        {state.catalog.server !== undefined && (
          <div className={css.meta}>
            <span>{`${t('server')}: ${state.catalog.server}`}</span>
          </div>
        )}
      </div>
      <div className={css.headActions}>
        {state.catalog.updatedAt !== undefined && (
          <span className={css.updated}>
            {t('lastRefreshed', { time: new Date(state.catalog.updatedAt).toLocaleTimeString() })}
          </span>
        )}
        <Button
          variant="outline"
          size="sm"
          icon={<IconRefreshOutline14 size={14} />}
          disabled={state.catalog.status === 'loading'}
          onClick={onRefresh}
        >
          {t('refresh')}
        </Button>
      </div>
    </header>
  )
}

/** One database row plus its expanded table list. */
function DatabaseNode({ t, db, tables, state, filter, onToggle, onSelect }: {
  t: DataTranslate
  db: string
  tables: string[]
  state: DataBrowserState
  filter: string
  onToggle: (db: string) => void
  onSelect: (db: string, table: string) => void
}) {
  const expanded = state.expanded.includes(db)
  const visibleTables = filter === ''
    ? tables
    : tables.filter(path => tableName(path).toLowerCase().includes(filter))
  return (
    <div className={css.dbNode}>
      <button
        type="button"
        className={css.treeRow}
        aria-expanded={expanded}
        onClick={() => { onToggle(db) }}
      >
        <IconChevronRightOutline14 size={12} className={clsx(css.chevron, expanded && css.chevronOpen)} />
        <span className={css.dbName} title={db}>{dbLabel(db)}</span>
        <span className={css.dbCount}>{t('tableCount', { count: tables.length })}</span>
      </button>
      {expanded && (
        <div className={css.tableList} role="group">
          {visibleTables.map((path) => {
            const name = tableName(path)
            const active = state.selection?.db === db && state.selection.table === name
            return (
              <button
                key={path}
                type="button"
                className={clsx(css.tableRow, active && css.tableRowActive)}
                title={path}
                onClick={() => { onSelect(db, name) }}
              >
                {name}
              </button>
            )
          })}
          {visibleTables.length === 0 && (
            <p className={css.treeHint}>{t('emptyCatalog')}</p>
          )}
        </div>
      )}
    </div>
  )
}

/** The DFS database tree pane. */
function TreePane({ t, state, onRefresh, onToggle, onSelect }: {
  t: DataTranslate
  state: DataBrowserState
  onRefresh: () => void
  onToggle: (db: string) => void
  onSelect: (db: string, table: string) => void
}) {
  const [filterText, setFilterText] = useState('')
  const filter = filterText.trim().toLowerCase()
  const tablesByDb = new Map<string, string[]>()
  for (const path of state.catalog.tables) {
    const db = tableDb(path)
    const list = tablesByDb.get(db)
    if (list === undefined) tablesByDb.set(db, [path])
    else list.push(path)
  }
  const databases = state.catalog.databases.filter((db) => {
    if (filter === '') return true
    if (db.toLowerCase().includes(filter)) return true
    return (tablesByDb.get(db) ?? []).some(path => tableName(path).toLowerCase().includes(filter))
  })
  return (
    <aside className={css.treePane}>
      <input
        type="search"
        className={css.filter}
        placeholder={t('filterPlaceholder')}
        value={filterText}
        onChange={event => { setFilterText(event.target.value) }}
      />
      {state.catalog.errorMessage !== undefined && (
        <p className={css.banner} role="alert">{t('refreshFailed', { message: state.catalog.errorMessage })}</p>
      )}
      {state.catalog.truncated && (
        <p className={css.hint} role="status">{t('truncatedCatalog')}</p>
      )}
      <div className={css.tree}>
        {state.catalog.status === 'loading' && state.catalog.updatedAt === undefined && (
          <p className={css.treeHint} role="status">{t('catalogLoading')}</p>
        )}
        {state.catalog.status === 'error' && (
          <div className={css.treeError}>
            <p className={css.errorText} role="alert">{t('catalogFailed')}</p>
            <Button variant="outline" size="sm" onClick={onRefresh}>{t('retry')}</Button>
          </div>
        )}
        {state.catalog.status === 'ready' && databases.length === 0 && filter === '' && (
          <p className={css.treeHint} role="status">{t('emptyCatalog')}</p>
        )}
        {databases.map(db => (
          <DatabaseNode
            key={db}
            t={t}
            db={db}
            tables={tablesByDb.get(db) ?? []}
            state={state}
            filter={filter}
            onToggle={onToggle}
            onSelect={onSelect}
          />
        ))}
      </div>
    </aside>
  )
}

/** The page window bar under the grid. */
function PaginationBar({ t, state, onPrev, onNext, onLimit, onRefreshPage }: {
  t: DataTranslate
  state: DataBrowserState
  onPrev: () => void
  onNext: () => void
  onLimit: (limit: number) => void
  onRefreshPage: () => void
}) {
  const { page, schema } = state
  const loading = page.status === 'loading'
  const rowCount = schema.rowCount
  const atStart = page.offset === 0
  const atEnd = page.rows.length < page.limit
    || (rowCount !== undefined && page.offset + page.limit >= rowCount)
  return (
    <div className={css.pager}>
      <Button variant="outline" size="sm" disabled={loading || atStart} onClick={onPrev}>
        {t('prevPage')}
      </Button>
      <Button variant="outline" size="sm" disabled={loading || atEnd} onClick={onNext}>
        {t('nextPage')}
      </Button>
      <span className={css.pageWindow}>
        {page.rows.length === 0
          ? t('pageWindow', { from: 0, to: 0 })
          : t('pageWindow', { from: page.offset + 1, to: page.offset + page.rows.length })}
      </span>
      {rowCount !== undefined && (
        <Tag tone="neutral">{t('rowCount', { count: rowCount })}</Tag>
      )}
      <select
        className={css.pageSize}
        aria-label={t('pageSize', { count: '' })}
        value={page.limit}
        disabled={loading}
        onChange={event => { onLimit(Number(event.target.value)) }}
      >
        {PAGE_SIZES.map(size => (
          <option key={size} value={size}>{t('pageSize', { count: size })}</option>
        ))}
      </select>
      <Button
        variant="ghost"
        size="sm"
        icon={<IconRefreshOutline14 size={14} />}
        disabled={loading}
        onClick={onRefreshPage}
        aria-label={t('refresh')}
      />
      {page.elapsedMs !== undefined && (
        <span className={css.elapsed}>{t('elapsed', { ms: page.elapsedMs })}</span>
      )}
    </div>
  )
}

/** The selected table's content pane: schema-informed grid plus paging. */
function ContentPane({ t, state, onPrev, onNext, onLimit, onRefreshPage }: {
  t: DataTranslate
  state: DataBrowserState
  onPrev: () => void
  onNext: () => void
  onLimit: (limit: number) => void
  onRefreshPage: () => void
}) {
  const selection = state.selection
  if (selection === undefined) {
    return (
      <section className={css.contentPane}>
        <div className={css.center}>
          <p className={css.hint} role="status">{t('selectHint')}</p>
        </div>
      </section>
    )
  }
  const columns = gridColumns(state)
  return (
    <section className={css.contentPane}>
      <div className={css.contentHead}>
        <span className={css.tablePath} title={`${selection.db}/${selection.table}`}>
          {`${dbLabel(selection.db)}/${selection.table}`}
        </span>
        {state.schema.status === 'ready' && (
          <Tag tone="neutral">{t('colCount', { count: columns.length })}</Tag>
        )}
      </div>
      {state.schema.status === 'loading' && (
        <p className={css.hint} role="status">{t('schemaLoading')}</p>
      )}
      {state.schema.status === 'error' && (
        <p className={css.banner} role="alert">{t('schemaFailed', { message: state.schema.errorMessage ?? '' })}</p>
      )}
      {state.schema.status === 'ready' && (
        <>
          {state.page.errorMessage !== undefined && (
            <p className={css.banner} role="alert">{t('pageFailed', { message: state.page.errorMessage })}</p>
          )}
          {state.page.truncated && (
            <p className={css.hint} role="status">{t('truncatedPage')}</p>
          )}
          <div className={css.gridWrap}>
            <table className={css.table}>
              <thead>
                <tr>
                  {columns.map(column => (
                    <th key={column.name}>
                      <span className={css.colName}>{column.name}</span>
                      {column.type !== undefined && <span className={css.colType}>{column.type}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {state.page.rows.map((row: DataRow, index) => (
                  <tr key={state.page.offset + index}>
                    {columns.map(column => {
                      const cellIndex = state.page.columns.indexOf(column.name)
                      return (
                        <td key={column.name} className={css.mono}>
                          <Cell cell={cellIndex < 0 ? null : (row[cellIndex] ?? null)} />
                        </td>
                      )
                    })}
                  </tr>
                ))}
                {state.page.status === 'ready' && state.page.rows.length === 0 && (
                  <tr>
                    <td className={css.emptyRow} colSpan={Math.max(columns.length, 1)}>{t('emptyPage')}</td>
                  </tr>
                )}
                {state.page.status === 'loading' && (
                  <tr>
                    <td className={css.emptyRow} colSpan={Math.max(columns.length, 1)}>{t('pageLoading')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <PaginationBar
            t={t}
            state={state}
            onPrev={onPrev}
            onNext={onNext}
            onLimit={onLimit}
            onRefreshPage={onRefreshPage}
          />
        </>
      )}
    </section>
  )
}

/**
 * Render the data browser panel.
 * @param props - locale copy, the browser snapshot, and its actions.
 * @returns the panel tree.
 */
export function DataPanel(props: DataPanelProps) {
  const { t } = props
  const state = props.useDataBrowser(snapshot => snapshot)
  return (
    <div className={css.root}>
      <Header t={t} state={state} onRefresh={props.refreshCatalog} />
      <div className={css.body}>
        <TreePane
          t={t}
          state={state}
          onRefresh={props.refreshCatalog}
          onToggle={props.toggleExpand}
          onSelect={props.selectTable}
        />
        <ContentPane
          t={t}
          state={state}
          onPrev={props.prevPage}
          onNext={props.nextPage}
          onLimit={props.setPageLimit}
          onRefreshPage={props.refreshPage}
        />
      </div>
    </div>
  )
}
