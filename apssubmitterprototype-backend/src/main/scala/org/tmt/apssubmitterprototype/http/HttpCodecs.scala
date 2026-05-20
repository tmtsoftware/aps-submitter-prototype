package org.tmt.apssubmitterprototype.http

import org.apache.pekko.http.scaladsl.marshallers.sprayjson.SprayJsonSupport
import org.tmt.apssubmitterprototype.core.models.{LoadSequenceRequest, SequenceTemplateList}
import play.api.libs.json.{JsValue, Json}
import spray.json.{DefaultJsonProtocol, JsValue as SprayJsValue, RootJsonFormat, deserializationError}

trait HttpCodecs extends SprayJsonSupport with DefaultJsonProtocol {

  implicit val loadSequenceRequestFormat: RootJsonFormat[LoadSequenceRequest]   = jsonFormat1(LoadSequenceRequest.apply)
  implicit val sequenceTemplateListFormat: RootJsonFormat[SequenceTemplateList] = jsonFormat1(SequenceTemplateList.apply)

  // Bridge Play JsValue through Spray as a RootJsonFormat so complete() can marshal it
  implicit val playJsValueFormat: RootJsonFormat[JsValue] = new RootJsonFormat[JsValue] {
    def write(v: JsValue): SprayJsValue  = spray.json.JsonParser(Json.stringify(v))
    def read(v: SprayJsValue): JsValue   = Json.parse(v.compactPrint)
  }
}
