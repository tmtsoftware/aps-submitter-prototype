export interface LoadSequenceRequest {
  configPath: string
}

export interface SequenceTemplateList {
  paths: string[]
}

export interface SubstitutionParam {
  stepName: string
  paramName: string
  paramValue: unknown  // number | string | boolean — whatever JSON value the backend expects
}

export interface BuildSequenceRequest {
  template: unknown
  substitutions: SubstitutionParam[]
}
