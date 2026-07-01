package org.tmt.apssubmitterprototype.http

import org.apache.pekko.http.scaladsl.marshallers.sprayjson.SprayJsonSupport
import org.tmt.apssubmitterprototype.core.models.{BuildSequenceRequest, LoadSequenceRequest, SequenceTemplateList, SubstitutionParam}
import play.api.libs.json.{JsValue, Json}
import spray.json.{DefaultJsonProtocol, JsValue as SprayJsValue, RootJsonFormat, deserializationError}

trait HttpCodecs extends SprayJsonSupport with DefaultJsonProtocol {

  implicit val loadSequenceRequestFormat: RootJsonFormat[LoadSequenceRequest]   = jsonFormat1(LoadSequenceRequest.apply)
  implicit val sequenceTemplateListFormat: RootJsonFormat[SequenceTemplateList] = jsonFormat1(SequenceTemplateList.apply)

  // Bridge Play JsValue through Spray
  implicit val playJsValueFormat: RootJsonFormat[JsValue] = new RootJsonFormat[JsValue] {
    def write(v: JsValue): SprayJsValue = spray.json.JsonParser(Json.stringify(v))
    def read(v: SprayJsValue): JsValue  = Json.parse(v.compactPrint)
  }

  // SubstitutionParam: { stepName, paramName, paramValue }
  // paramValue is an arbitrary JSON value (Int, Float, String, etc.)
  implicit val substitutionParamFormat: RootJsonFormat[SubstitutionParam] = new RootJsonFormat[SubstitutionParam] {
    def write(s: SubstitutionParam): SprayJsValue = {
      import spray.json.*
      spray.json.JsObject(
        "stepName"   -> spray.json.JsString(s.stepName),
        "paramName"  -> spray.json.JsString(s.paramName),
        "paramValue" -> spray.json.JsonParser(Json.stringify(s.paramValue))
      )
    }
    def read(v: SprayJsValue): SubstitutionParam = v match {
      case spray.json.JsObject(fields) =>
        val stepName   = fields.get("stepName").collect  { case spray.json.JsString(s) => s }
          .getOrElse(deserializationError("SubstitutionParam missing stepName"))
        val paramName  = fields.get("paramName").collect { case spray.json.JsString(s) => s }
          .getOrElse(deserializationError("SubstitutionParam missing paramName"))
        val paramValue = fields.get("paramValue")
          .map(pv => Json.parse(pv.compactPrint))
          .getOrElse(deserializationError("SubstitutionParam missing paramValue"))
        SubstitutionParam(stepName, paramName, paramValue)
      case _ => deserializationError("SubstitutionParam must be a JSON object")
    }
  }

  // BuildSequenceRequest: { template: [...], substitutions: [...] }
  implicit val buildSequenceRequestFormat: RootJsonFormat[BuildSequenceRequest] = new RootJsonFormat[BuildSequenceRequest] {
    def write(r: BuildSequenceRequest): SprayJsValue = {
      import spray.json.*
      spray.json.JsObject(
        "template"      -> spray.json.JsonParser(Json.stringify(r.template)),
        "substitutions" -> spray.json.JsArray(r.substitutions.map(substitutionParamFormat.write).toVector)
      )
    }
    def read(v: SprayJsValue): BuildSequenceRequest = v match {
      case spray.json.JsObject(fields) =>
        val template = fields.get("template")
          .map(t => Json.parse(t.compactPrint))
          .getOrElse(deserializationError("BuildSequenceRequest missing template"))
        val substitutions = fields.get("substitutions").collect {
          case spray.json.JsArray(elems) => elems.map(substitutionParamFormat.read).toList
        }.getOrElse(List.empty)
        BuildSequenceRequest(template, substitutions)
      case _ => deserializationError("BuildSequenceRequest must be a JSON object")
    }
  }
}
