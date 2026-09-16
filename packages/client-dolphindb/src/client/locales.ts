/** Locale bundles for the DolphinDB plugin-configuration card. */

/** Locale keys the card renders. */
export type DolphinDBLocaleKey =
  | 'title' | 'description' | 'expand' | 'collapse' | 'readOnly' | 'unsaved'
  | 'empty' | 'activeBadge' | 'activeGroup'
  | 'edit' | 'remove' | 'removeActiveHint' | 'save' | 'saving' | 'cancel'
  | 'host' | 'port' | 'username' | 'invalidPort' | 'hostRequired' | 'usernameRequired'
  | 'password' | 'passwordHint' | 'passwordSetBadge' | 'passwordUnsetBadge'
  | 'clearPassword'
  | 'addTitle' | 'name' | 'nameHint' | 'nameInvalid' | 'addPasswordHint' | 'addPasswordRef' | 'add' | 'adding'
  | 'saveFailed'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** This card's own copy namespace. */
    'settings.dolphindb': DolphinDBLocaleKey
  }
}

/** English copy. */
export const en: Record<DolphinDBLocaleKey, string> = {
  title: 'DolphinDB',
  description: 'The servers the DolphinDB tools connect to.',
  expand: 'Show settings',
  collapse: 'Hide settings',
  readOnly: 'This deployment stores settings read-only.',
  unsaved: 'Unsaved',
  empty: 'No server is registered yet; add one below.',
  activeBadge: 'Active',
  activeGroup: 'Active server',
  edit: 'Edit',
  remove: 'Delete',
  removeActiveHint: 'Switch the active server before deleting it.',
  save: 'Save',
  saving: 'Saving…',
  cancel: 'Cancel',
  host: 'Host',
  port: 'Port',
  username: 'Username',
  invalidPort: 'Enter a whole number between 1 and 65535.',
  hostRequired: 'Enter a host.',
  usernameRequired: 'Enter a username.',
  password: 'Password',
  passwordHint: 'Stored outside the settings file. Save with a new one to replace it; leave blank to keep the current password.',
  passwordSetBadge: 'Password set',
  passwordUnsetBadge: 'No password',
  clearPassword: 'Clear',
  addTitle: 'Add a server',
  name: 'Name',
  nameHint: 'A unique key for this server; its password credential reference derives from it.',
  nameInvalid: 'Enter a server name that is not already in use.',
  addPasswordHint: 'Optional — leave blank to set the password later from the server\'s edit form.',
  addPasswordRef: 'The password is stored as credential {ref}.',
  add: 'Add server',
  adding: 'Adding…',
  saveFailed: 'The deployment did not accept these values; they were left for you to correct.',
}

/** Simplified Chinese copy. */
export const zh: Record<DolphinDBLocaleKey, string> = {
  title: 'DolphinDB',
  description: 'DolphinDB 工具连接的服务器。',
  expand: '展开设置',
  collapse: '收起设置',
  readOnly: '本部署的设置为只读。',
  unsaved: '未保存',
  empty: '尚未注册服务器，请在下方添加。',
  activeBadge: '当前',
  activeGroup: '当前服务器',
  edit: '编辑',
  remove: '删除',
  removeActiveHint: '请先切换到其他服务器，再删除当前服务器。',
  save: '保存',
  saving: '保存中…',
  cancel: '取消',
  host: '主机',
  port: '端口',
  username: '用户名',
  invalidPort: '请输入 1 到 65535 之间的整数端口。',
  hostRequired: '请输入主机地址。',
  usernameRequired: '请输入用户名。',
  password: '密码',
  passwordHint: '不写入设置文件。填入新密码并保存即替换；留空表示保持当前密码。',
  passwordSetBadge: '已设置密码',
  passwordUnsetBadge: '未设置密码',
  clearPassword: '清除',
  addTitle: '新增服务器',
  name: '名称',
  nameHint: '服务器的唯一标识，其密码凭据引用由它派生。',
  nameInvalid: '请输入一个未被占用的服务器名称。',
  addPasswordHint: '可选——留空可稍后在该服务器的编辑表单中再设。',
  addPasswordRef: '密码将存为凭据 {ref}。',
  add: '添加',
  adding: '添加中…',
  saveFailed: '本部署没有接受这些值，已保留供你修改。',
}
