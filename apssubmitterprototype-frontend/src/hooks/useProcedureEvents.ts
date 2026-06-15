import { EventKey, EventName, EventService, Prefix } from '@tmtsoftware/esw-ts'
import type { Subscription } from '@tmtsoftware/esw-ts'
import { useState, useEffect, useRef } from 'react'
import {
  decodeApsProcedureEvent,
  type ApsProcedureEvent
} from '../models/ProcedureEvent'

const PROCEDURE_EVENT_NAME = new EventName('apsProcedureEvent')

const APS_PROCEDURE_EVENT_KEYS = new Set([
  new EventKey(
    Prefix.fromString('APS.apsPeasSequencerA_SoftwareOnlyMode'),
    PROCEDURE_EVENT_NAME
  ),
  new EventKey(
    Prefix.fromString('APS.apsPeasSequencerB_SoftwareOnlyMode'),
    PROCEDURE_EVENT_NAME
  )
])

const MAX_EVENTS = 100

export const useProcedureEvents = (active: boolean) => {
  const [events, setEvents] = useState<ApsProcedureEvent[]>([])
  const [error, setError] = useState<string | undefined>(undefined)
  const subscriptionRef = useRef<Subscription | undefined>(undefined)

  const clear = () => setEvents([])

  useEffect(() => {
    if (!active) {
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

        console.log('useProcedureEvents: subscribing to', APS_PROCEDURE_EVENT_KEYS)

        subscriptionRef.current = eventService.subscribe(APS_PROCEDURE_EVENT_KEYS)(
          (event) => {
            console.log('RAW EVENT RECEIVED:', JSON.stringify(event))
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
        console.log('useProcedureEvents: subscription established', subscriptionRef.current)
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
