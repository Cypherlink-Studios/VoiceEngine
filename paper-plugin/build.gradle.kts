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
    compileOnly("io.papermc.paper:paper-api:1.21.4-R0.1-SNAPSHOT")
    implementation("org.java-websocket:Java-WebSocket:1.5.7")
    implementation("org.incendo:cloud-paper:2.0.0")
    implementation("org.incendo:cloud-annotations:2.0.0")
    compileOnly("com.google.code.gson:gson:2.11.0")

    testImplementation("io.papermc.paper:paper-api:1.21.4-R0.1-SNAPSHOT")
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
    archiveBaseName.set("VoiceEngine-paper")
    archiveClassifier.set("thin")
}

tasks.shadowJar {
    archiveBaseName.set("VoiceEngine-paper")
    archiveClassifier.set("")
    relocate("org.incendo.cloud", "com.voiceengine.libs.cloud")
    relocate("org.java_websocket", "com.voiceengine.libs.websocket")
}

tasks.assemble {
    dependsOn(tasks.shadowJar)
}
