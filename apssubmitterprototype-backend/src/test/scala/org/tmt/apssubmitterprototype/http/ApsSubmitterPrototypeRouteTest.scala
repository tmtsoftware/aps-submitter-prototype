package org.tmt.apssubmitterprototype.http

import org.apache.pekko.http.scaladsl.server.Route
import org.apache.pekko.http.scaladsl.server.directives.BasicDirectives
import org.apache.pekko.http.scaladsl.testkit.ScalatestRouteTest
import csw.aas.http.AuthorizationPolicy.RealmRolePolicy
import csw.aas.http.SecurityDirectives
import csw.location.api.models.ComponentType.Service
import csw.location.api.models.Connection.HttpConnection
import csw.location.api.models.*
import csw.prefix.models.Prefix
import io.bullet.borer.compat.PekkoHttpCompat
import msocket.security.models.AccessToken
import org.mockito.Mockito.{reset, verify, when}
import org.scalatest.BeforeAndAfterEach
import org.scalatest.matchers.should.Matchers.should
import org.scalatest.wordspec.AnyWordSpec
import org.scalatestplus.mockito.MockitoSugar.mock
import org.tmt.apssubmitterprototype.TestHelper
import org.tmt.apssubmitterprototype.impl.ApsSubmitterPrototypeImpl
import org.tmt.apssubmitterprototype.core.models.{AdminGreetResponse, GreetResponse, UserInfo}

import scala.concurrent.Future
import scala.util.Random

class ApsSubmitterPrototypeRouteTest extends AnyWordSpec with ScalatestRouteTest with PekkoHttpCompat with BeforeAndAfterEach with HttpCodecs {

  private val service1: ApsSubmitterPrototypeImpl                   = mock[ApsSubmitterPrototypeImpl]
  private val service2                               = mock[JApsSubmitterPrototypeImplWrapper]
  private val securityDirectives: SecurityDirectives = mock[SecurityDirectives]
  private val token: AccessToken                     = mock[AccessToken]
  private val accessTokenDirective                   = BasicDirectives.extract(_ => token)

  private val route: Route = new ApsSubmitterPrototypeRoute(service1, service2, securityDirectives).route

  override protected def beforeEach(): Unit = reset(service1, securityDirectives)

  "ApsSubmitterPrototypeRoute" must {
    "greeting must delegate to service1.greeting" in {
      val response = GreetResponse(Random.nextString(10))
      val john     = UserInfo("John", "Smith")
      when(service1.greeting(john)).thenReturn(Future.successful(response))

      Post("/greeting", john) ~> route ~> check {
        verify(service1).greeting(UserInfo("John", "Smith"))
        responseAs[GreetResponse] should ===(response)
      }
    }

    "sayBye must delegate to service2.sayBye" in {
      val response = GreetResponse(Random.nextString(10))
      when(service2.sayBye()).thenReturn(Future.successful(response))

      Get("/sayBye") ~> route ~> check {
        verify(service2).sayBye()
        responseAs[GreetResponse] should ===(response)
      }
    }

    "adminGreeting must check for Esw-user role and delegate to service1.adminGreeting" in {
      val response = AdminGreetResponse(Random.nextString(10))
      val policy   = RealmRolePolicy("Esw-user")
      val john     = UserInfo("John", "Smith")
      when(securityDirectives.sPost(policy)).thenReturn(accessTokenDirective)
      when(service1.adminGreeting(john)).thenReturn(Future.successful(response))

      Post("/adminGreeting", john) ~> route ~> check {
        verify(service1).adminGreeting(UserInfo("John", "Smith"))
        verify(securityDirectives).sPost(policy)
        responseAs[AdminGreetResponse] should ===(response)
      }
    }
  }

  val connection: Connection.HttpConnection = HttpConnection(ComponentId(Prefix(TestHelper.randomSubsystem, "apssubmitterprototype"), Service))
}
