package org.tmt.apssubmitterprototype.http

import org.apache.pekko.http.scaladsl.server.Directives.*
import org.apache.pekko.http.scaladsl.server.Route
import org.tmt.apssubmitterprototype.core.models.LoadSequenceRequest
import org.tmt.apssubmitterprototype.service.ApsSubmitterPrototypeService

import scala.concurrent.ExecutionContext

class ApsSubmitterPrototypeRoute(
    service: ApsSubmitterPrototypeService
)(implicit ec: ExecutionContext)
    extends HttpCodecs {

  val route: Route =
    pathPrefix("sequence") {
      path("templates") {
        get {
          complete(service.listTemplates())
        }
      } ~
      path("load") {
        post {
          entity(as[LoadSequenceRequest]) { request =>
            complete(service.loadSequence(request))
          }
        }
      }
    }
}
