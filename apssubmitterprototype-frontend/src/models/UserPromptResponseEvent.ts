import type { Event } from '@tmtsoftware/esw-ts'
import { EventName, Prefix, SystemEvent, stringKey } from '@tmtsoftware/esw-ts'

// originatingPromptType mirrors apsProcedureEvent.dialogKey for a USER_PROMPT
// event: it tells the UI (and, on the way back, the sequencer) whether the
// prompt being responded to was a DECISION (Yes/No/Abort) or a WARNING
// (Retry/Continue/Abort) style dialog.
export type OriginatingPromptType = 'DECISION' | 'WARNING'

export type DecisionResponse = 'YES' | 'NO' | 'ABORT' | 'N/A'
export type ErrorResponse = 'RETRY' | 'CONTINUE' | 'ABORT' | 'N/A'

export interface UserPromptResponseEvent {
  originatingPromptType: OriginatingPromptType
  // Stable, human-readable id echoed back from the originating
  // apsProcedureEvent's messageId - useful for logging/display but NOT
  // unique per invocation. Use originatingMessageUuid for correlation.
  originatingMessageId: string
  // Per-invocation uuid echoed back from the originating apsProcedureEvent's
  // messageUuid. This is the value the sequencer's step handler matches on
  // to correlate a response with the specific prompt that triggered it.
  originatingMessageUuid: string
  decisionResponse: DecisionResponse
  errorResponse: ErrorResponse
}

const USER_PROMPT_RESPONSE_EVENT_NAME = new EventName('userPromptResponseEvent')

const originatingPromptTypeKey  = stringKey('originatingPromptType')
const originatingMessageIdKey   = stringKey('originatingMessageId')
const originatingMessageUuidKey = stringKey('originatingMessageUuid')
const decisionResponseKey       = stringKey('decisionResponse')
const errorResponseKey          = stringKey('errorResponse')

// Published by the UI under the sequencer's own prefix - the same prefix that
// sent the originating USER_PROMPT apsProcedureEvent - so the sequencer's
// step handler can subscribe to its own component's userPromptResponseEvent
// key and wait for it.
export const buildUserPromptResponseEvent = (
  sourcePrefix: string,
  response: UserPromptResponseEvent
): SystemEvent =>
  SystemEvent.make(
    Prefix.fromString(sourcePrefix),
    USER_PROMPT_RESPONSE_EVENT_NAME
  )
    .add(originatingPromptTypeKey.set([response.originatingPromptType]))
    .add(originatingMessageIdKey.set([response.originatingMessageId]))
    .add(originatingMessageUuidKey.set([response.originatingMessageUuid]))
    .add(decisionResponseKey.set([response.decisionResponse]))
    .add(errorResponseKey.set([response.errorResponse]))

export const decodeUserPromptResponseEvent = (
  event: Event
): UserPromptResponseEvent | undefined => {
  const originatingPromptType  = event.get(originatingPromptTypeKey)?.values[0]
  const originatingMessageId   = event.get(originatingMessageIdKey)?.values[0]
  const originatingMessageUuid = event.get(originatingMessageUuidKey)?.values[0]
  const decisionResponse       = event.get(decisionResponseKey)?.values[0]
  const errorResponse          = event.get(errorResponseKey)?.values[0]

  if (!originatingPromptType || !originatingMessageId || !originatingMessageUuid) return undefined

  return {
    originatingPromptType: originatingPromptType as OriginatingPromptType,
    originatingMessageId,
    originatingMessageUuid,
    decisionResponse: (decisionResponse ?? 'N/A') as DecisionResponse,
    errorResponse: (errorResponse ?? 'N/A') as ErrorResponse
  }
}
