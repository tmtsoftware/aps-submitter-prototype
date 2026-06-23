package org.tmt.apssubmitterprototype.impl

import org.apache.pekko.actor.typed.ActorSystem
import csw.config.api.scaladsl.ConfigClientService
import org.tmt.apssubmitterprototype.core.models.SequenceTemplateList
import org.tmt.apssubmitterprototype.service.ApsSubmitterPrototypeService
import play.api.libs.json.*

import java.nio.file.Paths
import scala.concurrent.{ExecutionContext, Future}

class ApsSubmitterPrototypeImpl(configClient: ConfigClientService)(implicit
    ec: ExecutionContext,
    system: ActorSystem[?]
) extends ApsSubmitterPrototypeService {

  private val RefPrefix = "REF:"

  def listTemplates(): Future[SequenceTemplateList] =
    Future.successful(SequenceTemplateList(List.empty))

  def loadTemplate(configPath: String): Future[JsValue] = {
    val path = Paths.get(configPath)
    configClient
      .getActive(path)
      .flatMap {
        case Some(configData) =>
          configData.toStringF(system).map(Json.parse)
        case None =>
          Future.failed(
            new RuntimeException(
              s"Config file not found or has no active version: $configPath"
            )
          )
      }
  }

  def buildSequence(template: JsValue): Future[JsValue] = {
    // template is a JSON array of SequenceCommands
    val commands = template.as[JsArray].value.toSeq
    Future
      .traverse(commands)(resolveCommand)
      .map(resolved => JsArray(resolved))
  }

  // Walk a single command's paramSet and resolve any REF StringKey values
  private def resolveCommand(command: JsValue): Future[JsValue] = {
    val paramSet = (command \ "paramSet").asOpt[JsArray].getOrElse(JsArray.empty)
    Future
      .traverse(paramSet.value.toSeq)(resolveParam)
      .map { resolvedParams =>
        command.as[JsObject] + ("paramSet" -> JsArray(resolvedParams))
      }
  }

  // If this param is a StringKey whose first value starts with "REF:", fetch
  // the referenced config path and substitute the raw JSON string as the value.
  // All other params are returned unchanged.
  private def resolveParam(param: JsValue): Future[JsValue] = {
    (param \ "StringKey").asOpt[JsObject] match {
      case Some(stringKey) =>
        val values = (stringKey \ "values").asOpt[JsArray].getOrElse(JsArray.empty)
        values.value.headOption.flatMap(_.asOpt[String]).filter(_.startsWith(RefPrefix)) match {
          case Some(refValue) =>
            val configPath = refValue.stripPrefix(RefPrefix)
            loadTemplate(configPath).map { refJson =>
              // Substitute: replace the single REF string with the fetched JSON serialised as a string
              val resolvedValues = JsArray(Seq(JsString(Json.stringify(refJson))))
              val resolvedKey    = stringKey + ("values" -> resolvedValues)
              JsObject(Seq("StringKey" -> resolvedKey))
            }
          case None =>
            Future.successful(param)
        }
      case None =>
        Future.successful(param)
    }
  }
}
