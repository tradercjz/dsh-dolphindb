/** Locale bundles for the DolphinDB cluster console panel. */

/** Locale keys the panel renders. */
export type ClusterConsoleLocaleKey =
  | 'panelLabel' | 'title'
  | 'badgeCluster' | 'badgeSingle'
  | 'server' | 'node' | 'controller'
  | 'refresh' | 'lastRefreshed' | 'loading' | 'retry' | 'loadFailed' | 'refreshFailed'
  | 'singleNodeHint' | 'emptyNodes'
  | 'startSelected' | 'stopSelected' | 'selectedCount' | 'clearSelection'
  | 'confirmStartTitle' | 'confirmStopTitle' | 'confirmStartBody' | 'confirmStopBody'
  | 'confirm' | 'cancel' | 'close' | 'operating'
  | 'startAccepted' | 'stopAccepted' | 'actionFailed'
  | 'colName' | 'colRole' | 'colState' | 'colSite' | 'colCpu' | 'colLoad' | 'colMemory' | 'colJobs' | 'colTasks'
  | 'roleData' | 'roleAgent' | 'roleController' | 'roleSingle' | 'roleComputing' | 'roleUnknown'
  | 'stateOnline' | 'stateOffline' | 'stateUnknown'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** This panel's own copy namespace. */
    'dolphindb.console': ClusterConsoleLocaleKey
  }
}

/** English copy. */
export const en: Record<ClusterConsoleLocaleKey, string> = {
  panelLabel: 'Cluster',
  title: 'DolphinDB Cluster Console',
  badgeCluster: 'Cluster',
  badgeSingle: 'Single-node',
  server: 'Server',
  node: 'Node',
  controller: 'Controller',
  refresh: 'Refresh',
  lastRefreshed: 'Updated {time}',
  loading: 'Loading the cluster overview…',
  retry: 'Retry',
  loadFailed: 'The cluster overview could not be loaded.',
  refreshFailed: 'Refresh failed: {message}',
  singleNodeHint: 'This is a single-node deployment; node start/stop is unavailable.',
  emptyNodes: 'The cluster overview lists no nodes.',
  startSelected: 'Start selected',
  stopSelected: 'Stop selected',
  selectedCount: '{count} selected',
  clearSelection: 'Clear',
  confirmStartTitle: 'Start nodes',
  confirmStopTitle: 'Stop nodes',
  confirmStartBody: 'The controller will be asked to start these {count} node(s):',
  confirmStopBody: 'The controller will be asked to stop these {count} node(s); their running work is interrupted:',
  confirm: 'Confirm',
  cancel: 'Cancel',
  close: 'Close',
  operating: 'Sending the request to the controller…',
  startAccepted: 'Start accepted by the controller ({count} node(s), {elapsed} ms).',
  stopAccepted: 'Stop accepted by the controller ({count} node(s), {elapsed} ms).',
  actionFailed: 'Node operation failed: {message}',
  colName: 'Name',
  colRole: 'Role',
  colState: 'State',
  colSite: 'Site',
  colCpu: 'CPU',
  colLoad: 'Avg load',
  colMemory: 'Memory (used / max)',
  colJobs: 'Jobs (run / queued)',
  colTasks: 'Tasks (run / queued)',
  roleData: 'Data',
  roleAgent: 'Agent',
  roleController: 'Controller',
  roleSingle: 'Single',
  roleComputing: 'Computing',
  roleUnknown: 'Unknown ({mode})',
  stateOnline: 'Online',
  stateOffline: 'Offline',
  stateUnknown: 'Unknown ({state})',
}

/** Simplified Chinese copy. */
export const zh: Record<ClusterConsoleLocaleKey, string> = {
  panelLabel: '集群',
  title: 'DolphinDB 集群控制台',
  badgeCluster: '集群',
  badgeSingle: '单机',
  server: '服务器',
  node: '节点',
  controller: '控制器',
  refresh: '刷新',
  lastRefreshed: '更新于 {time}',
  loading: '正在加载集群概览…',
  retry: '重试',
  loadFailed: '集群概览加载失败。',
  refreshFailed: '刷新失败：{message}',
  singleNodeHint: '当前为单机部署，节点启停不可用。',
  emptyNodes: '集群概览中没有节点。',
  startSelected: '启动选中',
  stopSelected: '停止选中',
  selectedCount: '已选 {count} 个',
  clearSelection: '清除',
  confirmStartTitle: '启动节点',
  confirmStopTitle: '停止节点',
  confirmStartBody: '将请求控制器启动以下 {count} 个节点：',
  confirmStopBody: '将请求控制器停止以下 {count} 个节点，其上正在运行的工作会被中断：',
  confirm: '确认',
  cancel: '取消',
  close: '关闭',
  operating: '正在向控制器发送请求…',
  startAccepted: '启动请求已被控制器接受（{count} 个节点，{elapsed} ms）。',
  stopAccepted: '停止请求已被控制器接受（{count} 个节点，{elapsed} ms）。',
  actionFailed: '节点操作失败：{message}',
  colName: '名称',
  colRole: '角色',
  colState: '状态',
  colSite: '站点',
  colCpu: 'CPU',
  colLoad: '平均负载',
  colMemory: '内存（已用 / 上限）',
  colJobs: '作业（运行 / 排队）',
  colTasks: '任务（运行 / 排队）',
  roleData: '数据',
  roleAgent: '代理',
  roleController: '控制器',
  roleSingle: '单机',
  roleComputing: '计算',
  roleUnknown: '未知（{mode}）',
  stateOnline: '在线',
  stateOffline: '离线',
  stateUnknown: '未知（{state}）',
}
