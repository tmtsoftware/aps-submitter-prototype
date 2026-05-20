package org.tmt.apssubmitterprototype.impl;

import esw.http.template.wiring.JCswServices;
import org.hamcrest.CoreMatchers;
import org.junit.Test;
import org.mockito.Mockito;
import org.scalatestplus.testng.TestNGSuite;
import org.tmt.apssubmitterprototype.core.models.GreetResponse;

import java.util.concurrent.ExecutionException;

import static org.hamcrest.MatcherAssert.assertThat;

public class JApsSubmitterPrototypeImplTest extends TestNGSuite {

  @Test
  public void shouldCallBye() throws ExecutionException, InterruptedException {
    JCswServices mock = Mockito.mock(JCswServices.class);
    JApsSubmitterPrototypeImpl jApsSubmitterPrototype = new JApsSubmitterPrototypeImpl(mock);
    GreetResponse greetResponse = new GreetResponse("Bye!!!");
    assertThat(jApsSubmitterPrototype.sayBye().get(), CoreMatchers.is(greetResponse));
  }
}
