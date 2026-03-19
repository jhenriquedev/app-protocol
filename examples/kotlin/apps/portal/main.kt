package app.protocol.examples.kotlin.apps.portal

import kotlinx.browser.document
import org.w3c.dom.HTMLElement

fun main() {
    val root =
        (document.getElementById("root") as? HTMLElement) ?: run {
            val element = document.createElement("div") as HTMLElement
            element.id = "root"
            document.body?.appendChild(element)
            element
        }

    bootstrap().mountRoot(root)
}
