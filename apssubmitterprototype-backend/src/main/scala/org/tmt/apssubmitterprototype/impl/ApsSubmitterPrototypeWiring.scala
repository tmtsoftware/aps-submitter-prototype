package org.tmt.apssubmitterprototype.impl

import csw.config.client.scaladsl.ConfigClientFactory
import esw.http.template.wiring.ServerWiring
import org.apache.pekko.http.scaladsl.server.Route
import org.tmt.apssubmitterprototype.http.ApsSubmitterPrototypeRoute

class ApsSubmitterPrototypeWiring(override val port: Option[Int] = None) extends ServerWiring {
  override val actorSystemName: String = "aps-submitter-prototype"

  import actorRuntime.{ec, typedSystem}

  private lazy val configClient =
    ConfigClientFactory.clientApi(typedSystem, cswServices.locationService)

  private lazy val service = new ApsSubmitterPrototypeImpl(configClient)(ec, typedSystem)
  private lazy val route   = new ApsSubmitterPrototypeRoute(service)

  override def routes: Route = route.route
}
