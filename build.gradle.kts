plugins {
    base
}

tasks.register("assembleDebug") {
    doLast {
        println("Simulating compile debug for Node.js Fullstack React App")
    }
}

tasks.register("lint") {
    doLast {
        println("Simulating lint for Node.js Fullstack React App")
    }
}
