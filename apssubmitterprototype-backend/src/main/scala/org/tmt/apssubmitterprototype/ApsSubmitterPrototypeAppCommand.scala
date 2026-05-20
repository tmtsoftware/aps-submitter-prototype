package org.tmt.apssubmitterprototype

import caseapp.{CommandName, ExtraName, HelpMessage}

sealed trait ApsSubmitterPrototypeAppCommand

object ApsSubmitterPrototypeAppCommand {

  @CommandName("start")
  final case class StartOptions(
      @HelpMessage("port of the app")
      @ExtraName("p")
      port: Option[Int]
  ) extends ApsSubmitterPrototypeAppCommand

}
