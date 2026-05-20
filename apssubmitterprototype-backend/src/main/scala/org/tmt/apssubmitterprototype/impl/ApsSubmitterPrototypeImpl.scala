package org.tmt.apssubmitterprototype.impl

import org.apache.pekko.actor.typed.ActorSystem
import csw.config.api.scaladsl.ConfigClientService
import csw.params.core.formats.JsonSupport
import org.tmt.apssubmitterprototype.core.models.{LoadSequenceRequest, SequenceTemplateList}
import org.tmt.apssubmitterprototype.service.ApsSubmitterPrototypeService
import play.api.libs.json.{JsArray, JsValue, Json}

import java.nio.file.Paths
import scala.concurrent.{ExecutionContext, Future}

class ApsSubmitterPrototypeImpl(configClient: ConfigClientService)(implicit
    ec: ExecutionContext,
    system: ActorSystem[?]
) extends ApsSubmitterPrototypeService {

  // list() is not available on ConfigClientService — returns empty for now
  def listTemplates(): Future[SequenceTemplateList] =
    Future.successful(SequenceTemplateList(List.empty))

  def loadSequence(request: LoadSequenceRequest): Future[JsValue] = {
    val path = Paths.get(request.configPath)
    configClient
      .getActive(path)
      .flatMap {
        case Some(configData) =>
          configData.toStringF(system).map { jsonStr =>
            // Parse the stored JSON directly and return it as-is
            Json.parse(jsonStr)
          }
        case None =>
          Future.failed(
            new RuntimeException(
              s"Config file not found or has no active version: ${request.configPath}"
            )
          )
      }
  }
}
