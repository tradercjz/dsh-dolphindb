/** Locale bundles for the DolphinDB data browser panel. */

/** Locale keys the panel renders. */
export type DataBrowserLocaleKey =
  | 'panelLabel' | 'title'
  | 'server' | 'refresh' | 'lastRefreshed' | 'retry'
  | 'catalogLoading' | 'catalogFailed' | 'refreshFailed' | 'emptyCatalog' | 'truncatedCatalog'
  | 'filterPlaceholder' | 'tableCount'
  | 'selectHint' | 'schemaLoading' | 'schemaFailed' | 'rowCount' | 'colCount'
  | 'pageLoading' | 'pageFailed' | 'emptyPage' | 'truncatedPage'
  | 'prevPage' | 'nextPage' | 'pageWindow' | 'pageSize' | 'elapsed'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** This panel's own copy namespace. */
    'dolphindb.data': DataBrowserLocaleKey
  }
}

/** English copy. */
export const en: Record<DataBrowserLocaleKey, string> = {
  panelLabel: 'Data',
  title: 'DolphinDB Data Browser',
  server: 'Server',
  refresh: 'Refresh',
  lastRefreshed: 'Updated {time}',
  retry: 'Retry',
  catalogLoading: 'Loading the DFS catalog…',
  catalogFailed: 'The DFS catalog could not be loaded.',
  refreshFailed: 'Refresh failed: {message}',
  emptyCatalog: 'No DFS databases are visible to this login.',
  truncatedCatalog: 'The catalog is too large and was truncated; ask the host to raise its cap if something is missing.',
  filterPlaceholder: 'Filter databases and tables…',
  tableCount: '{count} table(s)',
  selectHint: 'Pick a DFS table on the left to inspect its schema and rows.',
  schemaLoading: 'Loading the table schema…',
  schemaFailed: 'The table schema could not be loaded: {message}',
  rowCount: '{count} rows',
  colCount: '{count} columns',
  pageLoading: 'Loading rows…',
  pageFailed: 'The page could not be loaded: {message}',
  emptyPage: 'This page holds no rows.',
  truncatedPage: 'The executor budget truncated this page.',
  prevPage: 'Previous',
  nextPage: 'Next',
  pageWindow: 'Rows {from}–{to}',
  pageSize: '{count} / page',
  elapsed: '{ms} ms',
}

/** Simplified Chinese copy. */
export const zh: Record<DataBrowserLocaleKey, string> = {
  panelLabel: '数据',
  title: 'DolphinDB 数据浏览',
  server: '服务器',
  refresh: '刷新',
  lastRefreshed: '更新于 {time}',
  retry: '重试',
  catalogLoading: '正在加载 DFS 目录…',
  catalogFailed: 'DFS 目录加载失败。',
  refreshFailed: '刷新失败：{message}',
  emptyCatalog: '当前登录看不到任何 DFS 数据库。',
  truncatedCatalog: '目录过大已被截断，如有缺失请调整 host 端上限。',
  filterPlaceholder: '筛选库 / 表…',
  tableCount: '{count} 张表',
  selectHint: '在左侧选择一张 DFS 表查看结构与数据。',
  schemaLoading: '正在加载表结构…',
  schemaFailed: '表结构加载失败：{message}',
  rowCount: '共 {count} 行',
  colCount: '{count} 列',
  pageLoading: '正在加载数据…',
  pageFailed: '数据加载失败：{message}',
  emptyPage: '本页没有数据。',
  truncatedPage: '本页被执行器预算截断。',
  prevPage: '上一页',
  nextPage: '下一页',
  pageWindow: '第 {from}–{to} 行',
  pageSize: '每页 {count} 行',
  elapsed: '{ms} ms',
}
