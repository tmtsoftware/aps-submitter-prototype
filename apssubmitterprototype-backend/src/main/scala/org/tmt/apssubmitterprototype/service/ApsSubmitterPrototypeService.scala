package org.tmt.apssubmitterprototype.service

import org.tmt.apssubmitterprototype.core.models.SequenceTemplateList
import play.api.libs.json.JsValue

import scala.concurrent.Future

trait ApsSubmitterPrototypeService {
  def listTemplates(): Future[SequenceTemplateList]
  def loadTemplate(configPath: String): Future[JsValue]
  def buildSequence(template: JsValue): Future[JsValue]
}
