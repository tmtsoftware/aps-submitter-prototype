lazy val `aps-submitter-prototype-backend` = project
  .in(file("."))
  .aggregate(`ignore`)
  .settings(
    inThisBuild(
      List(
        scalaVersion := "3.6.4",
        version := "0.1.0"
      )
    ),
    name := "aps-submitter-prototype-backend",
    fork := true,
    resolvers += "jitpack" at "https://jitpack.io",
    libraryDependencies ++= Seq(
      Libs.`esw-http-template-wiring` % "compile->compile;test->test",
      Libs.`pekko-http-spray-json`,
      Libs.`embedded-keycloak`        % Test,
      Libs.`scalatest`                % Test,
      Libs.`pekko-http-testkit`       % Test,
      Libs.`mockito`                  % Test,
      Libs.`junit4-interface`         % Test,
      Libs.`testng-6-7`               % Test,
      Libs.`pekko-actor-testkit-typed` % Test,
      Libs.`pekko-stream-testkit`     % Test
    ),
    Test / fork := true
  )
lazy val `ignore` = project.in(file(".ignore"))
