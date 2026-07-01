package org.tmt.apssubmitterprototype.core.models

import play.api.libs.json.JsValue

case class SubstitutionParam(stepName: String, paramName: String, paramValue: JsValue)

case class BuildSequenceRequest(template: JsValue, substitutions: List[SubstitutionParam] = List.empty)
