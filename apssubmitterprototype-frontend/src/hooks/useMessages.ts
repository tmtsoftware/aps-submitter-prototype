import { useState, useEffect, useCallback } from 'react'

type MessageMap = Record<string, string>

const parseProperties = (text: string): MessageMap => {
  const map: MessageMap = {}
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    // Skip blank lines and comments
    if (!line || line.startsWith('#')) continue
    const sep = line.indexOf('=')
    if (sep === -1) continue
    const key   = line.substring(0, sep).trim()
    const value = line.substring(sep + 1).trim()
    if (key) map[key] = value
  }
  return map
}

// Fetches public/messages.properties once at mount and exposes a stable
// getMessage(messageId) lookup. Falls back to the raw messageId if the key
// is not found, so unknown keys never break the UI.
export const useMessages = () => {
  const [messages, setMessages] = useState<MessageMap>({})
  const [error, setError]       = useState<string | undefined>()

  useEffect(() => {
    fetch('/messages.properties')
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load messages.properties: ${res.status}`)
        return res.text()
      })
      .then(text => setMessages(parseProperties(text)))
      .catch(err  => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  const getMessage = useCallback(
    (messageId: string): string => messages[messageId] ?? messageId,
    [messages]
  )

  return { getMessage, messageLoadError: error }
}
