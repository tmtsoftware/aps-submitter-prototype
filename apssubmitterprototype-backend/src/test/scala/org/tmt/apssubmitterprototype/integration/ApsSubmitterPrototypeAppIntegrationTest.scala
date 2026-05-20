package org.tmt.apssubmitterprototype.integration

import org.apache.pekko.actor.typed.{ActorSystem, SpawnProtocol}
import org.apache.pekko.http.scaladsl.Http
import org.apache.pekko.http.scaladsl.model.Uri.Path
import org.apache.pekko.http.scaladsl.model.*
import org.apache.pekko.http.scaladsl.model.headers.{Authorization, OAuth2BearerToken}
import org.apache.pekko.http.scaladsl.unmarshalling.Unmarshal
import csw.aas.core.commons.AASConnection
import csw.location.api.models.Connection.HttpConnection
import csw.location.api.models.*
import csw.location.api.scaladsl.LocationService
import csw.network.utils.Networks
import csw.testkit.scaladsl.ScalaTestFrameworkTestKit
import io.bullet.borer.Json
import org.scalatest.matchers.should.Matchers
import org.scalatest.wordspec.AnyWordSpecLike
import org.tmt.embedded_keycloak.KeycloakData.{ApplicationUser, Client, Realm}
import org.tmt.embedded_keycloak.impl.StopHandle
import org.tmt.embedded_keycloak.utils.BearerToken
import org.tmt.embedded_keycloak.{EmbeddedKeycloak, KeycloakData, Settings}
import org.tmt.apssubmitterprototype.impl.ApsSubmitterPrototypeWiring
import org.tmt.apssubmitterprototype.core.models.{AdminGreetResponse, GreetResponse, UserInfo}
import org.tmt.apssubmitterprototype.http.HttpCodecs

import scala.compiletime.uninitialized
import scala.concurrent.duration.DurationInt
import scala.concurrent.{Await, ExecutionContext}

class ApsSubmitterPrototypeAppIntegrationTest extends ScalaTestFrameworkTestKit with AnyWordSpecLike with Matchers with HttpCodecs {
  import frameworkTestKit.*

  override implicit val patienceConfig: PatienceConfig = PatienceConfig(10.seconds)

  val hostname: String                 = Networks().hostname
  val keycloakPort                     = 8081
  val apsSubmitterPrototypeAppPort                    = 8085
  val apsSubmitterPrototypeWiring                     = new ApsSubmitterPrototypeWiring(Some(apsSubmitterPrototypeAppPort))
  val appConnection: HttpConnection    = apsSubmitterPrototypeWiring.settings.httpConnection

  var appLocation: HttpLocation  = uninitialized
  var appUri: Uri                = uninitialized
  var keycloakHandle: StopHandle = uninitialized

  protected override def beforeAll(): Unit = {
    super.beforeAll()
    keycloakHandle = startAndRegisterKeycloak(keycloakPort)
    apsSubmitterPrototypeWiring.start(Metadata.empty).futureValue
    appLocation = locationService.resolve(appConnection, 5.seconds).futureValue.get
    appUri = Uri(appLocation.uri.toString)
  }

  protected override def afterAll(): Unit = {
    keycloakHandle.stop()
    locationService.unregister(AASConnection.value)
    apsSubmitterPrototypeWiring.stop().futureValue
    super.afterAll()
  }

  "ApsSubmitterPrototypeWiring" must {

    "start the aps-submitter-prototype app and register with location service" in {
      val resolvedLocation = locationService.resolve(appConnection, 5.seconds).futureValue
      resolvedLocation.get.connection should ===(appConnection)
    }

    "should call greeting and return GreetResponse as a result" in {
      val userInfo = UserInfo("John", "Smith")
      val request = HttpRequest(
        HttpMethods.POST,
        uri = appUri.withPath(Path / "greeting"),
        entity = HttpEntity(ContentTypes.`application/json`, Json.encode(userInfo).toUtf8String.getBytes)
      )

      val response: HttpResponse = Http().singleRequest(request).futureValue
      response.status should ===(StatusCode.int2StatusCode(200))
      Unmarshal(response).to[GreetResponse].futureValue should ===(GreetResponse(s"Hello user: ${userInfo.firstName} ${userInfo.lastName}!!!"))
    }

    "should call adminGreeting and return AdminGreetResponse as a result" in {
      val token    = getToken("admin", "password1")()
      val userInfo = UserInfo("John", "Smith")
      val request = HttpRequest(
        HttpMethods.POST,
        uri = appUri.withPath(Path / "adminGreeting"),
        headers = token.map(x => Seq(Authorization(OAuth2BearerToken(x)))).getOrElse(Nil),
        entity = HttpEntity(ContentTypes.`application/json`, Json.encode(userInfo).toUtf8String.getBytes())
      )

      val response: HttpResponse = Http().singleRequest(request).futureValue

      response.status should ===(StatusCode.int2StatusCode(200))
      Unmarshal(response).to[AdminGreetResponse].futureValue should ===(
        AdminGreetResponse(s"Hello admin user: ${userInfo.firstName} ${userInfo.lastName}!!!")
      )
    }

    "should call adminGreeting and return 403 as a result without required role" in {
      val token    = getToken("nonAdmin", "password2")()
      val userInfo = UserInfo("John", "Smith")
      val request = HttpRequest(
        HttpMethods.POST,
        uri = appUri.withPath(Path / "adminGreeting"),
        headers = token.map(x => Seq(Authorization(OAuth2BearerToken(x)))).getOrElse(Nil),
        entity = HttpEntity(ContentTypes.`application/json`, Json.encode(userInfo).toUtf8String.getBytes())
      )

      val response: HttpResponse = Http().singleRequest(request).futureValue

      response.status should ===(StatusCode.int2StatusCode(403))
    }
  }

  private def startAndRegisterKeycloak(port: Int): StopHandle = {
    val eswUserRole  = "Esw-user"
    val eswAdminRole = "Esw-admin"
    val locationServerClient =
      Client(name = "tmt-frontend-app", clientType = "public", passwordGrantEnabled = true)
    val keycloakData = KeycloakData(
      realms = Set(
        Realm(
          name = "TMT",
          users = Set(
            ApplicationUser("admin", "password1", "admin", "admin", "admin@tmt.org", realmRoles = Set(eswUserRole, eswAdminRole)),
            ApplicationUser("nonAdmin", "password2", "nonAdmin", "nonAdmin", "nonAdmin@tmt.org")
          ),
          clients = Set(locationServerClient),
          realmRoles = Set(eswUserRole, eswAdminRole)
        )
      )
    )
    val embeddedKeycloak = new EmbeddedKeycloak(keycloakData, Settings(port = port, printProcessLogs = false))
    val stopHandle       = Await.result(embeddedKeycloak.startServer(), 1.minute)
    locationService.register(HttpRegistration(AASConnection.value, keycloakPort, "")).futureValue
    stopHandle
  }

  private def getToken(userName: String, password: String): () => Some[String] = { () =>
    Some(
      BearerToken
        .fromServer(
          realm = "TMT",
          client = "tmt-frontend-app",
          host = hostname,
          port = keycloakPort,
          username = userName,
          password = password
        )
        .token
    )
  }

}
