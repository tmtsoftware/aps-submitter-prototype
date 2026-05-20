package org.tmt.apssubmitterprototype.http

import java.util.concurrent.CompletableFuture

import org.mockito.Mockito.{verify, when}
import org.scalatestplus.mockito.MockitoSugar.mock
import org.scalatest.concurrent.ScalaFutures.convertScalaFuture
import org.scalatest.matchers.should.Matchers
import org.scalatest.wordspec.AnyWordSpec
import org.tmt.apssubmitterprototype.impl.JApsSubmitterPrototypeImpl
import org.tmt.apssubmitterprototype.core.models.GreetResponse

class JApsSubmitterPrototypeImplWrapperTest extends AnyWordSpec with Matchers {

  "ApsSubmitterPrototypeImplWrapper" must {
    "delegate sayBye to JApsSubmitterPrototypeImpl.sayBye" in {
      val jApsSubmitterPrototypeImpl       = mock[JApsSubmitterPrototypeImpl]
      val apsSubmitterPrototypeImplWrapper = new JApsSubmitterPrototypeImplWrapper(jApsSubmitterPrototypeImpl)

      val apsSubmitterPrototypeResponse = mock[GreetResponse]
      when(jApsSubmitterPrototypeImpl.sayBye()).thenReturn(CompletableFuture.completedFuture(apsSubmitterPrototypeResponse))

      apsSubmitterPrototypeImplWrapper.sayBye().futureValue should ===(apsSubmitterPrototypeResponse)
      verify(jApsSubmitterPrototypeImpl).sayBye()
    }
  }
}
