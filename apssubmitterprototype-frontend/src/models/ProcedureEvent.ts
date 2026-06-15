import type { Event } from '@tmtsoftware/esw-ts'
import { stringKey } from '@tmtsoftware/esw-ts'

export type ProcedureEventType =
  | 'INFO_MESSAGE'
  | 'WARN_MESSAGE'
  | 'USER_PROMPT'
  | 'VIZ_DISPLAY'

export interface ApsProcedureEvent {
  type: ProcedureEventType
  dialogKey: string
  helpKey: string
  messageId: string
  eventTime: string
  source: string
}

const typeKey      = stringKey('type')
const dialogKeyKey = stringKey('dialogKey')
const helpKeyKey   = stringKey('helpKey')
const messageIdKey = stringKey('messageId')

export const decodeApsProcedureEvent = (
  event: Event
): ApsProcedureEvent | undefined => {
  const type      = event.get(typeKey)?.values[0]
  const dialogKey = event.get(dialogKeyKey)?.values[0]
  const helpKey   = event.get(helpKeyKey)?.values[0]
  const messageId = event.get(messageIdKey)?.values[0]

  if (!type || !dialogKey || !helpKey || !messageId) return undefined

  return {
    type: type as ProcedureEventType,
    dialogKey,
    helpKey,
    messageId,
    eventTime: event.eventTime,
    source: `${event.source.subsystem}.${event.source.componentName}`
  }
}
