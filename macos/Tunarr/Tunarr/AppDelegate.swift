//
//  AppDelegate.swift
//  Tunarr
//
//  Created by Christian Benincasa on 7/26/25.
//

import AppKit
import OSLog
import SwiftUI

class AppDelegate: NSObject, NSApplicationDelegate {
    let bundle = Bundle.main
    let logger = Logger(subsystem: Bundle.main.bundleIdentifier!, category: "Tunarr Subprocess")
    var task = Process()

    func applicationDidFinishLaunching(_ notification: Notification) {
        guard let executablePath = Bundle.main.url(forAuxiliaryExecutable: "tunarr-macos")
        else {
            /// TODO: Do a popup here.
            logger.error("Error: Bundled executable 'tunarr-macos' not found.")
            return
        }

        guard let meilisearchPath = Bundle.main.url(forAuxiliaryExecutable: "meilisearch")
        else {
            logger.error("Error: Bundled executable 'meilisearch' not found")
            return
        }

        task.executableURL = executablePath
        var env = ProcessInfo.processInfo.environment
        env["TUNARR_MEILISEARCH_PATH"] = meilisearchPath.absoluteURL.path()
        task.currentDirectoryURL = FileManager.default
            .homeDirectoryForCurrentUser
            .appendingPathComponent(
                "Library"
            ).appendingPathComponent("Preferences")
            .appendingPathComponent("tunarr")
        task.environment = env
        logger.info("\(env, privacy: .public)")

        let errorPipe = Pipe()
        task.standardError = errorPipe

        do {
            errorPipe.fileHandleForReading.readabilityHandler = { pipe in
                let data = pipe.availableData
                if let line = String(data: data, encoding: .utf8) {
                    if line.count > 0 {
                        self.logger.info(
                            "Process stderr: \(line.trimmingCharacters(in: .whitespacesAndNewlines), privacy: .public)"
                        )
                    }
                }
            }
            try task.run()

            logger.info("Successfully started Tunarr subprocess.")
        } catch {
            logger.error("Could not launch Tunarr. Reason: \(error, privacy: .public)")
        }
    }

    func applicationWillTerminate(_ aNotification: Notification) {
        logger.info("Shutting down Tunarr.")
        task.terminate()
        task.waitUntilExit()
    }
}
