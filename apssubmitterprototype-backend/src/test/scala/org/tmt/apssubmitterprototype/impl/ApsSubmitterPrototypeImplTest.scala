package org.tmt.apssubmitterprototype.impl

import org.scalatest.concurrent.ScalaFutures.convertScalaFuture
import org.scalatest.matchers.should.Matchers
import org.scalatest.wordspec.AnyWordSpec
import org.tmt.apssubmitterprototype.core.models.{AdminGreetResponse, GreetResponse, UserInfo}

class ApsSubmitterPrototypeImplTest extends AnyWordSpec with Matchers {

  "ApsSubmitterPrototypeImpl" must {
    "greeting should return greeting response of 'Hello user'" in {
      val apsSubmitterPrototypeImpl = new ApsSubmitterPrototypeImpl()
      apsSubmitterPrototypeImpl.greeting(UserInfo("John", "Smith")).futureValue should ===(GreetResponse("Hello user: John Smith!!!"))
    }

    "adminGreeting should return greeting response of 'Hello admin user'" in {
      val apsSubmitterPrototypeImpl = new ApsSubmitterPrototypeImpl()
      apsSubmitterPrototypeImpl.adminGreeting(UserInfo("John", "Smith")).futureValue should ===(AdminGreetResponse("Hello admin user: John Smith!!!"))
    }
  }
}
