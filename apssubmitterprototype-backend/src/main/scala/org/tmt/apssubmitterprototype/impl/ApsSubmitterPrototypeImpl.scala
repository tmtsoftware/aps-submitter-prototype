package org.tmt.apssubmitterprototype.impl

import org.apache.pekko.actor.typed.ActorSystem
import csw.config.api.scaladsl.ConfigClientService
import org.tmt.apssubmitterprototype.core.models.{SequenceTemplateList, SubstitutionParam}
import org.tmt.apssubmitterprototype.service.ApsSubmitterPrototypeService
import play.api.libs.json.*

import java.nio.file.Paths
import scala.concurrent.{ExecutionContext, Future}

class ApsSubmitterPrototypeImpl(configClient: ConfigClientService)(implicit
    ec: ExecutionContext,
    system: ActorSystem[?]
) extends ApsSubmitterPrototypeService {

  private val RefPrefix = "REF:"

  // Guards against REF cycles recursing forever.
  private val MaxRefDepth = 25

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

  def buildSequence(template: JsValue, substitutions: List[SubstitutionParam]): Future[JsValue] = {
    val substituted = applySubstitutions(template, substitutions)
    resolveSequence(substituted, depth = 0)
  }

  // Apply substitutions to matching commands in the top-level template before
  // REF resolution. Matches on commandName = stepName and updates the param
  // whose key name = paramName with the supplied paramValue.
  private def applySubstitutions(sequence: JsValue, substitutions: List[SubstitutionParam]): JsValue = {
    if (substitutions.isEmpty) return sequence
    val commands = sequence.as[JsArray].value.toSeq.map { command =>
      val commandName = (command \ "commandName").asOpt[String].getOrElse("")
      val matching = substitutions.filter(_.stepName == commandName)
      if (matching.isEmpty) command
      else {
        val paramSet = (command \ "paramSet").asOpt[JsArray].getOrElse(JsArray.empty)
        val updatedParams = paramSet.value.toSeq.map { param =>
          // Each param is a wrapper object: { "IntKey": { keyName, values, units } }
          // Try each known key type to find the keyName and match it
          val updated = Seq("IntKey", "FloatKey", "StringKey", "DoubleKey", "LongKey").foldLeft(Option.empty[JsValue]) {
            case (Some(already), _) => Some(already)
            case (None, keyType) =>
              (param \ keyType \ "keyName").asOpt[String].flatMap { keyName =>
                matching.find(_.paramName == keyName).map { sub =>
                  val inner = (param \ keyType).as[JsObject]
                  val updatedInner = inner + ("values" -> JsArray(Seq(sub.paramValue)))
                  Json.obj(keyType -> updatedInner)
                }
              }
          }
          updated.getOrElse(param)
        }
        command.as[JsObject] + ("paramSet" -> JsArray(updatedParams))
      }
    }
    JsArray(commands)
  }

  // Resolve every command in a sequence recursively, resolving REF: substitutions
  // including REFs nested inside other REFs.
  private def resolveSequence(sequence: JsValue, depth: Int): Future[JsValue] = {
    if (depth > MaxRefDepth)
      Future.failed(new RuntimeException(
        s"REF substitution exceeded max depth of $MaxRefDepth - possible REF cycle"
      ))
    else {
      val commands = sequence.as[JsArray].value.toSeq
      Future
        .traverse(commands)(resolveCommand(_, depth))
        .map(resolved => JsArray(resolved))
    }
  }

  private def resolveCommand(command: JsValue, depth: Int): Future[JsValue] = {
    val paramSet = (command \ "paramSet").asOpt[JsArray].getOrElse(JsArray.empty)
    Future
      .traverse(paramSet.value.toSeq)(resolveParam(_, depth))
      .map { resolvedParams =>
        command.as[JsObject] + ("paramSet" -> JsArray(resolvedParams))
      }
  }

  // If this param is a StringKey whose first value starts with "REF:", fetch
  // the referenced config path, recursively resolve any REF: entries within it,
  // then substitute the fully-resolved JSON serialised as a string.
  private def resolveParam(param: JsValue, depth: Int): Future[JsValue] = {
    (param \ "StringKey").asOpt[JsObject] match {
      case Some(stringKey) =>
        val values = (stringKey \ "values").asOpt[JsArray].getOrElse(JsArray.empty)
        values.value.headOption.flatMap(_.asOpt[String]).filter(_.startsWith(RefPrefix)) match {
          case Some(refValue) =>
            val configPath = refValue.stripPrefix(RefPrefix)
            for {
              refJson      <- loadTemplate(configPath)
              resolvedJson <- resolveSequence(refJson, depth + 1)
            } yield {
              val resolvedValues = JsArray(Seq(JsString(Json.stringify(resolvedJson))))
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
