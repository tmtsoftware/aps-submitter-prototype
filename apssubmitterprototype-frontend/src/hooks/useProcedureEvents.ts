import { EventKey, EventName, EventService, Prefix } from '@tmtsoftware/esw-ts'
import type { Subscription } from '@tmtsoftware/esw-ts'
import { useState, useEffect, useRef } from 'react'
import {
  decodeApsProcedureEvent,
  type ApsProcedureEvent
} from '../models/ProcedureEvent'

// ---------------------------------------------------------------------------
// Event key — must match APS_SEQUENCER_PREFIX and APS_PROCEDURE_EVENT_NAME
// in ProcedureEvent.kt exactly
// ---------------------------------------------------------------------------
const APS_PROCEDURE_EVENT_KEY = new EventKey(
  Prefix.fromString('APS.sequencer'),
  new EventName('apsProcedureEvent')
)

// Max events to keep in state — prevents unbounded growth during long sequences
const MAX_EVENTS = 100

// ---------------------------------------------------------------------------
// useProcedureEvents
//
// Subscribes to apsProcedureEvent on the CSW Event Service and returns the
// live stream of decoded events.
//
// @param active  When true the subscription is open; when false it is
//                cancelled.  Pass `true` while a sequence is running and
//                `false` once it completes or errors, so the subscription
//                lifecycle is tied to the sequence lifecycle.
//
// Returns:
//   events  — ordered array of decoded ApsProcedureEvent, newest last
//   error   — set if the EventService subscription itself errors
//   clear   — call to reset the event list (e.g. before a new sequence run)
// ---------------------------------------------------------------------------
export const useProcedureEvents = (active: boolean) => {
  const [events, setEvents] = useState<ApsProcedureEvent[]>([])
  const [error, setError] = useState<string | undefined>(undefined)
  const subscriptionRef = useRef<Subscription | undefined>(undefined)

  const clear = () => setEvents([])

  useEffect(() => {
    if (!active) {
      // Cancel any open subscription when caller signals inactive
      subscriptionRef.current?.cancel()
      subscriptionRef.current = undefined
      return
    }

    let cancelled = false

    const startSubscription = async () => {
      try {
        console.log('useProcedureEvents: creating EventService...')
        const eventService = await EventService()
        console.log('useProcedureEvents: EventService created', eventService)
        if (cancelled) return

        const eventKeys = new Set([APS_PROCEDURE_EVENT_KEY])
        console.log(
          'useProcedureEvents: subscribing to',
          APS_PROCEDURE_EVENT_KEY
        )

        subscriptionRef.current = eventService.subscribe(eventKeys)(
          (event) => {
            console.log('RAW EVENT RECEIVED:', JSON.stringify(event))
            console.log('useProcedureEvents: received event', event)
            const decoded = decodeApsProcedureEvent(event)
            console.log('DECODED:', decoded)
            if (!decoded) return
            setEvents((prev) => {
              const updated = [...prev, decoded]
              return updated.length > MAX_EVENTS
                ? updated.slice(updated.length - MAX_EVENTS)
                : updated
            })
          },
          (err) => {
            console.error('useProcedureEvents: subscription error', err)
            setError(`Event subscription error: ${err.message}`)
          },
          () => {
            console.log('useProcedureEvents: subscription closed')
          }
        )
        console.log(
          'useProcedureEvents: subscription established',
          subscriptionRef.current
        )
      } catch (e) {
        console.error('useProcedureEvents: failed to start', e)
        if (!cancelled) {
          setError(
            `Failed to connect to Event Service: ${e instanceof Error ? e.message : String(e)}`
          )
        }
      }
    }

    startSubscription()

    return () => {
      cancelled = true
      subscriptionRef.current?.cancel()
      subscriptionRef.current = undefined
    }
  }, [active])

  return { events, error, clear }
}
