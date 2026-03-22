import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import org.jetbrains.kotlin.gradle.targets.js.webpack.KotlinWebpackConfig
import java.io.File

plugins {
    kotlin("multiplatform") version "2.2.0"
    kotlin("plugin.serialization") version "2.2.0"
}

group = "app.protocol.examples.kotlin"
version = "1.1.5"

val ktorVersion = "3.2.3"
val kotlinxCoroutinesVersion = "1.10.2"
val kotlinxSerializationVersion = "1.9.0"
val kotlinxDatetimeVersion = "0.7.1"

repositories {
    mavenCentral()
}

kotlin {
    jvm {
        compilerOptions {
            jvmTarget.set(JvmTarget.JVM_17)
        }
    }

    js(IR) {
        browser {
            commonWebpackConfig {
                outputFileName = "portal.js"
                devServer = (devServer ?: KotlinWebpackConfig.DevServer()).copy(
                    port = 5173,
                )
            }
        }
        binaries.executable()
    }

    sourceSets {
        commonMain.dependencies {
            implementation(kotlin("stdlib"))
            implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:$kotlinxCoroutinesVersion")
            implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:$kotlinxSerializationVersion")
            implementation("org.jetbrains.kotlinx:kotlinx-datetime:$kotlinxDatetimeVersion")
        }

        commonTest.dependencies {
            implementation(kotlin("test"))
        }

        jvmMain.dependencies {
            implementation("io.ktor:ktor-server-core:$ktorVersion")
            implementation("io.ktor:ktor-server-netty:$ktorVersion")
            implementation("io.ktor:ktor-server-call-logging:$ktorVersion")
            implementation("io.ktor:ktor-server-content-negotiation:$ktorVersion")
            implementation("io.ktor:ktor-server-status-pages:$ktorVersion")
            implementation("io.ktor:ktor-serialization-kotlinx-json:$ktorVersion")
        }

        jvmTest.dependencies {
            implementation(kotlin("test"))
        }

        jsTest.dependencies {
            implementation(kotlin("test"))
        }
    }
}

kotlin.sourceSets.named("commonMain") {
    kotlin.srcDirs("core", "cases")
    kotlin.exclude("**/*.ui.case.kt")
}

kotlin.sourceSets.named("jvmMain") {
    kotlin.srcDirs("apps/backend", "apps/agent", "packages/data")
}

kotlin.sourceSets.named("jsMain") {
    kotlin.srcDirs("cases", "apps/portal", "packages/design_system")
    kotlin.exclude("**/*.domain.case.kt")
    kotlin.exclude("**/*.api.case.kt")
    kotlin.exclude("**/*.agentic.case.kt")
}

val jvmMainCompilation = kotlin.targets.getByName("jvm").compilations.getByName("main")

tasks.register<JavaExec>("runBackendServer") {
    group = "application"
    description = "Run the APP Kotlin backend host."
    dependsOn(jvmMainCompilation.compileTaskProvider)
    classpath(jvmMainCompilation.runtimeDependencyFiles, jvmMainCompilation.output.allOutputs)
    mainClass.set("app.protocol.examples.kotlin.apps.backend.ServerKt")
}

tasks.register<JavaExec>("runAgentServer") {
    group = "application"
    description = "Run the APP Kotlin agent HTTP host."
    dependsOn(jvmMainCompilation.compileTaskProvider)
    classpath(jvmMainCompilation.runtimeDependencyFiles, jvmMainCompilation.output.allOutputs)
    mainClass.set("app.protocol.examples.kotlin.apps.agent.ServerKt")
}

tasks.register<JavaExec>("runAgentMcpServer") {
    group = "application"
    description = "Run the APP Kotlin agent MCP stdio host."
    dependsOn(jvmMainCompilation.compileTaskProvider)
    classpath(jvmMainCompilation.runtimeDependencyFiles, jvmMainCompilation.output.allOutputs)
    mainClass.set("app.protocol.examples.kotlin.apps.agent.Mcp_serverKt")
    standardInput = System.`in`
}

tasks.register("typecheck") {
    group = "verification"
    description = "Compile JVM and JS targets."
    dependsOn("compileKotlinJvm", "compileKotlinJs")
}

tasks.register("buildPortal") {
    group = "build"
    description = "Build the portal bundle."
    dependsOn("jsBrowserProductionWebpack")
}

tasks.register("runPortalDev") {
    group = "application"
    description = "Run the Kotlin/JS portal development server."
    dependsOn("jsBrowserDevelopmentRun")
}

tasks.register("printJvmRuntimeClasspath") {
    group = "help"
    description = "Print the runtime classpath for the JVM target."
    dependsOn(jvmMainCompilation.compileTaskProvider)
    doLast {
        val entries =
            ((jvmMainCompilation.runtimeDependencyFiles?.files ?: emptySet()) + jvmMainCompilation.output.allOutputs.files)
                .map(File::getAbsolutePath)
                .distinct()
        println(entries.joinToString(File.pathSeparator))
    }
}
