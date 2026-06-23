package org.tmt.apssubmitterprototype.http

import org.apache.pekko.http.scaladsl.marshallers.sprayjson.SprayJsonSupport
import org.tmt.apssubmitterprototype.core.models.{BuildSequenceRequest, LoadSequenceRequest, SequenceTemplateList}
import play.api.libs.json.{JsValue, Json}
import spray.json.{DefaultJsonProtocol, JsValue as SprayJsValue, RootJsonFormat, deserializationError}

trait HttpCodecs extends SprayJsonSupport with DefaultJsonProtocol {

  implicit val loadSequenceRequestFormat: RootJsonFormat[LoadSequenceRequest]   = jsonFormat1(LoadSequenceRequest.apply)
  implicit val sequenceTemplateListFormat: RootJsonFormat[SequenceTemplateList] = jsonFormat1(SequenceTemplateList.apply)

  // BuildSequenceRequest wraps a Play JsValue — bridge through Spray
  implicit val buildSequenceRequestFormat: RootJsonFormat[BuildSequenceRequest] = new RootJsonFormat[BuildSequenceRequest] {
    def write(r: BuildSequenceRequest): SprayJsValue = spray.json.JsonParser(Json.stringify(r.template))
    def read(v: SprayJsValue): BuildSequenceRequest  = BuildSequenceRequest(Json.parse(v.compactPrint))
  }

  // Bridge Play JsValue through Spray as a RootJsonFormat so complete() can marshal it
  implicit val playJsValueFormat: RootJsonFormat[JsValue] = new RootJsonFormat[JsValue] {
    def write(v: JsValue): SprayJsValue  = spray.json.JsonParser(Json.stringify(v))
    def read(v: SprayJsValue): JsValue   = Json.parse(v.compactPrint)
  }
}
