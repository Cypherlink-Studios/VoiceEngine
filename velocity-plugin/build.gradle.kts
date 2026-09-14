plugins {
    `java-library`
    id("com.gradleup.shadow") version "8.3.7"
}

group = "com.voiceengine"
version = "1.0.0-SNAPSHOT"

repositories {
    mavenCentral()
    maven("https://repo.papermc.io/repository/maven-public/")
}

dependencies {
    compileOnly("com.velocitypowered:velocity-api:3.4.0-SNAPSHOT")
    annotationProcessor("com.velocitypowered:velocity-api:3.4.0-SNAPSHOT")
    implementation("org.java-websocket:Java-WebSocket:1.5.7")
    implementation("org.incendo:cloud-velocity:2.0.0")
    implementation("org.incendo:cloud-annotations:2.0.0")
    implementation("org.yaml:snakeyaml:2.2")
    implementation("org.xerial:sqlite-jdbc:3.49.1.0")
    compileOnly("com.google.code.gson:gson:2.11.0")

    testImplementation("com.velocitypowered:velocity-api:3.4.0-SNAPSHOT")
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.4")
    testImplementation("org.mockito:mockito-core:5.14.2")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

val targetJava = providers.gradleProperty("javaVersion")
    .map { it.toInt() }
    .orElse(21)

java {
    toolchain {
        languageVersion.set(targetJava.map { JavaLanguageVersion.of(it) })
    }
}

tasks.withType<JavaCompile> {
    options.encoding = "UTF-8"
}

tasks.test {
    useJUnitPlatform()
}

tasks.jar {
    archiveBaseName.set("VoiceEngine-velocity")
    archiveClassifier.set("thin")
}

tasks.shadowJar {
    archiveBaseName.set("VoiceEngine-velocity")
    archiveClassifier.set("")
    mergeServiceFiles()
    relocate("org.incendo.cloud", "com.voiceengine.velocity.libs.cloud")
    relocate("org.java_websocket", "com.voiceengine.velocity.libs.websocket")
    relocate("org.yaml.snakeyaml", "com.voiceengine.velocity.libs.snakeyaml")
}

tasks.assemble {
    dependsOn(tasks.shadowJar)
}
