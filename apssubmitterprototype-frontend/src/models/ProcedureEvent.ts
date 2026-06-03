import type { Event } from '@tmtsoftware/esw-ts'
import { stringKey } from '@tmtsoftware/esw-ts'

// ---------------------------------------------------------------------------
// apsProcedureEvent — TypeScript model
//
// Mirrors the four parameters defined in ProcedureEvent.kt on the sequencer
// side. Published by sequence step handler functions at 1.0 Hz max rate.
// ---------------------------------------------------------------------------

/**
 * The four allowed values for the `type` parameter, matching the ICD spec
 * and the ProcedureEventType constants in ProcedureEvent.kt.
 */
export type ProcedureEventType =
  | 'INFO_MESSAGE'
  | 'WARN_MESSAGE'
  | 'USER_PROMPT'
  | 'VIZ_DISPLAY'

/**
 * Decoded, UI-ready representation of a single apsProcedureEvent.
 *
 * - type      : drives how the UI renders the notification
 * - dialogKey : identifies which dialog component/layout to render
 * - helpKey   : key for retrieving help text when the user clicks help
 * - messageId : key into the PEAS UI resource properties file for message body
 * - eventTime : UTC timestamp from the event, for display ordering
 */
export interface ApsProcedureEvent {
  type: ProcedureEventType
  dialogKey: string
  helpKey: string
  messageId: string
  eventTime: string
}

// Parameter key instances — created once and reused for all decoding
const typeKey = stringKey('type')
const dialogKeyKey = stringKey('dialogKey')
const helpKeyKey = stringKey('helpKey')
const messageIdKey = stringKey('messageId')

/**
 * Decodes a raw esw-ts Event into an ApsProcedureEvent.
 *
 * Returns undefined if any required parameter is missing, so callers
 * can safely filter out malformed or unrelated events.
 */
export const decodeApsProcedureEvent = (
  event: Event
): ApsProcedureEvent | undefined => {
  const type = event.get(typeKey)?.values[0]
  const dialogKey = event.get(dialogKeyKey)?.values[0]
  const helpKey = event.get(helpKeyKey)?.values[0]
  const messageId = event.get(messageIdKey)?.values[0]

  if (!type || !dialogKey || !helpKey || !messageId) return undefined

  return {
    type: type as ProcedureEventType,
    dialogKey,
    helpKey,
    messageId,
    eventTime: event.eventTime
  }
}
