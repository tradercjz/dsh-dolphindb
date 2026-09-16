/**
 * The DolphinDB card's rows: one registered server with its active switch,
 * staged connection fields and password, plus the form registering a new
 * server. Nothing here writes: a control reports what the user typed, and the
 * card's actions are the single point where a draft becomes a document
 * mutation or a credential write.
 */

import clsx from 'clsx'
import { Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  DolphinDBCardState, DolphinDBInvalidField, DolphinDBServerRow as ServerRowState,
} from './dolphindb-card-controller.ts'
import css from './DolphinDBCard.module.css'

/** Locale reader for this card's copy. */
type CardTranslate = TranslateNS<'settings.dolphindb'>

/** Copy key naming one invalid field's diagnostic. */
function invalidMessage(t: CardTranslate, field: DolphinDBInvalidField | undefined): string | undefined {
  if (field === 'name') return t('nameInvalid')
  if (field === 'host') return t('hostRequired')
  if (field === 'port') return t('invalidPort')
  if (field === 'username') return t('usernameRequired')
  return undefined
}

/** Props of one registered server's row. */
export interface ServerRowProps {
  /** Locale reader for this card's copy. */
  t: CardTranslate
  /** The server as the card renders it. */
  row: ServerRowState
  /** Whether the Host document accepts writes. */
  writable: boolean
  /** Make this server the active one. */
  onSetActive: (name: string) => void
  /** Open the connection fields for editing. */
  onStartEdit: (name: string) => void
  /** Drop the staged edits. */
  onCancelEdit: (name: string) => void
  /** Stage one connection-field or password draft. */
  onStageField: (name: string, field: 'host' | 'port' | 'username' | 'password', text: string) => void
  /** Write the staged connection fields and, when staged, the password. */
  onSave: (name: string) => void
  /** Remove the server from the registry. */
  onRemove: (name: string) => void
  /** Clear the stored password. */
  onClearPassword: (name: string) => void
}

/**
 * Render one registered server.
 * @param props - the row state, the copy reader, and the card's actions.
 * @returns the server row.
 */
export function ServerRow(props: ServerRowProps) {
  const { t, row } = props
  const disabled = !props.writable
  const message = invalidMessage(t, row.invalidField)
  return (
    <li className={css.server}>
      <div className={css.serverHead}>
        <input
          type="radio"
          className={css.activeRadio}
          name="dolphindb-active-server"
          aria-label={`${t('activeGroup')}: ${row.name}`}
          checked={row.active}
          disabled={disabled || row.active || row.saving}
          onChange={() => { props.onSetActive(row.name) }}
        />
        <span className={css.serverName}>{row.name}</span>
        <span className={css.serverAddr}>{`${row.host}:${row.port}`}</span>
        <span className={css.serverUser}>{row.username}</span>
        <span className={css.badges}>
          {row.active ? <Tag tone="neutral">{t('activeBadge')}</Tag> : null}
          <Tag tone={row.passwordConfigured ? 'neutral' : 'quiet'}>
            {row.passwordConfigured ? t('passwordSetBadge') : t('passwordUnsetBadge')}
          </Tag>
        </span>
        <button
          type="button"
          className={css.rowAction}
          disabled={disabled || row.editing || row.saving}
          onClick={() => { props.onStartEdit(row.name) }}
        >
          {t('edit')}
        </button>
        <button
          type="button"
          className={css.rowAction}
          disabled={disabled || row.active || row.saving}
          {...row.active ? { title: t('removeActiveHint') } : {}}
          onClick={() => { props.onRemove(row.name) }}
        >
          {t('remove')}
        </button>
      </div>
      {row.editing && row.draft !== undefined
        ? (
          <div className={css.editArea}>
            <div className={css.editGrid}>
              <label className={css.fieldLabel} htmlFor={`dolphindb-host-${row.name}`}>{t('host')}</label>
              <input
                id={`dolphindb-host-${row.name}`}
                className={row.invalidField === 'host' ? css.inputInvalid : css.input}
                type="text"
                value={row.draft.host}
                disabled={disabled || row.saving}
                onChange={(event) => { props.onStageField(row.name, 'host', event.target.value) }}
              />
              <label className={css.fieldLabel} htmlFor={`dolphindb-port-${row.name}`}>{t('port')}</label>
              <input
                id={`dolphindb-port-${row.name}`}
                className={row.invalidField === 'port' ? css.inputInvalid : css.input}
                type="text"
                inputMode="numeric"
                value={row.draft.port}
                disabled={disabled || row.saving}
                onChange={(event) => { props.onStageField(row.name, 'port', event.target.value) }}
              />
              <label className={css.fieldLabel} htmlFor={`dolphindb-username-${row.name}`}>{t('username')}</label>
              <input
                id={`dolphindb-username-${row.name}`}
                className={row.invalidField === 'username' ? css.inputInvalid : css.input}
                type="text"
                autoComplete="off"
                value={row.draft.username}
                disabled={disabled || row.saving}
                onChange={(event) => { props.onStageField(row.name, 'username', event.target.value) }}
              />
              <label className={css.fieldLabel} htmlFor={`dolphindb-password-${row.name}`}>{t('password')}</label>
              <input
                id={`dolphindb-password-${row.name}`}
                className={css.input}
                type="password"
                autoComplete="off"
                value={row.draft.password}
                disabled={disabled || row.saving || !row.passwordWritable}
                onChange={(event) => { props.onStageField(row.name, 'password', event.target.value) }}
              />
            </div>
            {message !== undefined ? <p className={css.invalid} role="status">{message}</p> : null}
            <div className={css.rowFooter}>
              <button
                type="button"
                className={css.discard}
                disabled={row.saving}
                onClick={() => { props.onCancelEdit(row.name) }}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                className={css.save}
                disabled={disabled || !row.draftDirty || row.invalidField !== undefined || row.saving}
                onClick={() => { props.onSave(row.name) }}
              >
                {t(row.saving ? 'saving' : 'save')}
              </button>
            </div>
          </div>
        )
        : null}
      <div className={css.passwordRow}>
        <p className={css.passwordHint}>{t('passwordHint')}</p>
        <button
          type="button"
          className={css.discard}
          disabled={!row.passwordWritable || !row.passwordConfigured || row.passwordBusy || row.saving}
          onClick={() => { props.onClearPassword(row.name) }}
        >
          {t('clearPassword')}
        </button>
      </div>
    </li>
  )
}

/** Props of the add-a-server form. */
export interface AddServerFormProps {
  /** Locale reader for this card's copy. */
  t: CardTranslate
  /** The card snapshot; the form reads its own drafts from it. */
  state: DolphinDBCardState
  /** Stage one add-form draft. */
  onStage: (field: 'name' | 'host' | 'port' | 'username' | 'password', text: string) => void
  /** Register the staged server and, when staged, write its password. */
  onAdd: () => void
}

/**
 * Render the add-a-server form.
 * @param props - the card snapshot, the copy reader, and the add actions.
 * @returns the form.
 */
export function AddServerForm(props: AddServerFormProps) {
  const { t, state } = props
  const disabled = !state.writable
  const draft = state.addDraft
  // An untouched field only keeps the button disabled; a diagnostic shows once
  // the field carries text it cannot accept (a duplicate name, a non-numeric port).
  const message = draft.name.trim() !== '' || draft.host.trim() !== ''
    || draft.port.trim() !== '' || draft.username.trim() !== ''
    ? invalidMessage(t, state.addInvalidField)
    : undefined
  return (
    <div className={css.addArea}>
      <p className={css.addTitle}>{t('addTitle')}</p>
      <div className={css.editGrid}>
        <label className={css.fieldLabel} htmlFor="dolphindb-add-name">{t('name')}</label>
        <input
          id="dolphindb-add-name"
          className={clsx(css.input, state.addInvalidField === 'name' && draft.name.trim() !== '' && css.inputInvalid)}
          type="text"
          value={draft.name}
          disabled={disabled || state.adding}
          onChange={(event) => { props.onStage('name', event.target.value) }}
        />
        <label className={css.fieldLabel} htmlFor="dolphindb-add-host">{t('host')}</label>
        <input
          id="dolphindb-add-host"
          className={css.input}
          type="text"
          value={draft.host}
          disabled={disabled || state.adding}
          onChange={(event) => { props.onStage('host', event.target.value) }}
        />
        <label className={css.fieldLabel} htmlFor="dolphindb-add-port">{t('port')}</label>
        <input
          id="dolphindb-add-port"
          className={clsx(css.input, state.addInvalidField === 'port' && draft.port.trim() !== '' && css.inputInvalid)}
          type="text"
          inputMode="numeric"
          value={draft.port}
          disabled={disabled || state.adding}
          onChange={(event) => { props.onStage('port', event.target.value) }}
        />
        <label className={css.fieldLabel} htmlFor="dolphindb-add-username">{t('username')}</label>
        <input
          id="dolphindb-add-username"
          className={css.input}
          type="text"
          autoComplete="off"
          value={draft.username}
          disabled={disabled || state.adding}
          onChange={(event) => { props.onStage('username', event.target.value) }}
        />
        <label className={css.fieldLabel} htmlFor="dolphindb-add-password">{t('password')}</label>
        <input
          id="dolphindb-add-password"
          className={css.input}
          type="password"
          autoComplete="off"
          value={draft.password}
          disabled={disabled || state.adding}
          onChange={(event) => { props.onStage('password', event.target.value) }}
        />
      </div>
      <p className={css.hint}>{t('nameHint')}</p>
      <p className={css.hint}>{t('addPasswordHint')}</p>
      {state.addPasswordRef !== undefined
        ? <p className={css.hint}>{t('addPasswordRef', { ref: state.addPasswordRef })}</p>
        : null}
      {message !== undefined && state.addInvalidField !== undefined
        ? <p className={css.invalid} role="status">{message}</p>
        : null}
      <div className={css.rowFooter}>
        <button
          type="button"
          className={css.save}
          disabled={disabled || state.addInvalidField !== undefined || state.adding}
          onClick={props.onAdd}
        >
          {t(state.adding ? 'adding' : 'add')}
        </button>
      </div>
    </div>
  )
}
