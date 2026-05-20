package org.tmt.apssubmitterprototype.service

import org.tmt.apssubmitterprototype.core.models.{LoadSequenceRequest, SequenceTemplateList}
import play.api.libs.json.JsValue

import scala.concurrent.Future

trait ApsSubmitterPrototypeService {
  def listTemplates(): Future[SequenceTemplateList]
  def loadSequence(request: LoadSequenceRequest): Future[JsValue]
}
