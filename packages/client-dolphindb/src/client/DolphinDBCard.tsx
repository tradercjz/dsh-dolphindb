/**
 * The DolphinDB card: the registered servers with their active switch,
 * connection fields, and password controls, plus the form registering a new
 * server. All data and callbacks arrive through the four props shares; the
 * controller owns the section reads, the drafts, and every write.
 */

import { useState } from 'react'
import clsx from 'clsx'
import { IconChevronDownOutline14, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { DolphinDBCardFace } from './dolphindb-card-controller.ts'
import { AddServerForm, ServerRow } from './rows.tsx'
import type {} from './slot-contract.ts'
import css from './DolphinDBCard.module.css'

/** Props the renderer binds for the DolphinDB card. */
export type DolphinDBCardProps =
  PropsRuntime<'settings.plugin.item'>
  & PropsLocale<'settings.dolphindb'>
  & InjectFace<DolphinDBCardFace>

/**
 * Render the DolphinDB card.
 * @param props - locale copy, the card snapshot, and its actions.
 * @returns the card, or nothing while the namespace is unavailable.
 */
export function DolphinDBCard(props: DolphinDBCardProps) {
  const { t } = props
  const state = props.useDolphinDBCard(snapshot => snapshot)
  const [open, setOpen] = useState(false)
  // A deployment that does not compose the DolphinDB plugin shows no trace of
  // it, rather than a disabled card the user cannot act on.
  if (!state.available) return null
  const title = t('title')
  const unsaved = state.servers.some(row => row.draftDirty)
  return (
    <li className={clsx(css.card, open && css.cardOpen)}>
      <button
        type="button"
        className={css.header}
        aria-expanded={open}
        aria-label={`${t(open ? 'collapse' : 'expand')}: ${title}`}
        onClick={() => { setOpen(!open) }}
      >
        <span className={css.headText}>
          <span className={css.name}>{title}</span>
          <span className={css.description}>{t('description')}</span>
        </span>
        {unsaved ? <Tag tone="neutral" className={css.pending}>{t('unsaved')}</Tag> : null}
        <IconChevronDownOutline14 className={clsx(css.chevron, open && css.chevronOpen)} />
      </button>
      {open
        ? (
          <div className={css.body}>
            {!state.writable ? <p className={css.readOnly} role="status">{t('readOnly')}</p> : null}
            {state.failed ? <p className={css.failed} role="status">{t('saveFailed')}</p> : null}
            {state.servers.length === 0 ? <p className={css.hint} role="status">{t('empty')}</p> : null}
            <ul className={css.servers}>
              {state.servers.map(row => (
                <ServerRow
                  key={row.name}
                  t={t}
                  row={row}
                  writable={state.writable}
                  onSetActive={props.setActive}
                  onStartEdit={props.startEdit}
                  onCancelEdit={props.cancelEdit}
                  onStageField={props.stageServerField}
                  onSave={props.saveServer}
                  onRemove={props.removeServer}
                  onClearPassword={props.clearPassword}
                />
              ))}
            </ul>
            <AddServerForm
              t={t}
              state={state}
              onStage={props.stageAddField}
              onAdd={props.addServer}
            />
          </div>
        )
        : null}
    </li>
  )
}
