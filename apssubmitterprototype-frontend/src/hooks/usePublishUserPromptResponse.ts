import { EventService } from '@tmtsoftware/esw-ts'
import { useRef, useCallback } from 'react'
import {
  buildUserPromptResponseEvent,
  type UserPromptResponseEvent
} from '../models/UserPromptResponseEvent'

// Lazily creates and reuses a single EventService instance for publishing,
// rather than reconnecting on every response. Mirrors the unauthenticated
// EventService() usage already established in useProcedureEvents.ts.
export const usePublishUserPromptResponse = () => {
  const eventServiceRef = useRef<ReturnType<typeof EventService> | undefined>(
    undefined
  )

  const publishResponse = useCallback(
    async (sourcePrefix: string, response: UserPromptResponseEvent) => {
      if (!eventServiceRef.current) {
        eventServiceRef.current = EventService()
      }
      const eventService = await eventServiceRef.current
      const event = buildUserPromptResponseEvent(sourcePrefix, response)
      await eventService.publish(event)
    },
    []
  )

  return { publishResponse }
}
