import type { LoadSequenceRequest } from '../models/Models'
import { get, post } from './Http'

const templatesUrl    = (baseUrl: string) => baseUrl + 'sequence/templates'
const loadTemplateUrl = (baseUrl: string) => baseUrl + 'sequence/template'
const buildSequenceUrl = (baseUrl: string) => baseUrl + 'sequence/build'

export const fetchTemplates = async (baseUrl: string): Promise<string[]> => {
  const response = await get<{ paths: string[] }>(templatesUrl(baseUrl))
  return response.parsedBody?.paths ?? []
}

export const loadTemplate = async (
  baseUrl: string,
  configPath: string
): Promise<unknown> => {
  const request: LoadSequenceRequest = { configPath }
  const response = await post<LoadSequenceRequest, unknown>(
    loadTemplateUrl(baseUrl),
    request
  )
  return response.parsedBody
}

export const buildSequence = async (
  baseUrl: string,
  template: unknown
): Promise<unknown> => {
  const response = await post<unknown, unknown>(
    buildSequenceUrl(baseUrl),
    template
  )
  return response.parsedBody
}
