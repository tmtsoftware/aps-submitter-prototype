import type { LoadSequenceRequest } from '../models/Models'
import { get, post } from './Http'

const templatesUrl = (baseUrl: string) => baseUrl + 'sequence/templates'
const loadSequenceUrl = (baseUrl: string) => baseUrl + 'sequence/load'

export const fetchTemplates = async (baseUrl: string): Promise<string[]> => {
  const response = await get<{ paths: string[] }>(templatesUrl(baseUrl))
  return response.parsedBody?.paths ?? []
}

export const loadSequence = async (
  baseUrl: string,
  configPath: string
): Promise<unknown> => {
  const request: LoadSequenceRequest = { configPath }
  const response = await post<LoadSequenceRequest, unknown>(
    loadSequenceUrl(baseUrl),
    request
  )
  return response.parsedBody
}
