//
//  TunarrApp.swift
//  Tunarr
//
//  Created by Christian Benincasa on 7/26/25.
//

import SwiftUI

@main
struct TunarrApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        MenuBarExtra("Tunarr", image: "StatusBarButtonImage") {
            Button("Launch Web UI") {
                let portString = ProcessInfo.processInfo.environment[
                    "TUNARR_SERVER_PORT"
                ]
                NSLog("Port string is \(portString ?? "null")")
                let port = Int(portString ?? "") ?? 8000
                let url = "http://localhost:\(port)"
                NSWorkspace.shared.open(NSURL(string: url)! as URL)
            }
            Button("Show Logs") {
                NSWorkspace.shared.activateFileViewerSelecting(
                    [
                        URL(
                            fileURLWithPath:
                                FileManager.default
                                .homeDirectoryForCurrentUser
                                .appendingPathComponent(
                                    "Library"
                                ).appendingPathComponent("Preferences")
                                .appendingPathComponent("tunarr")
                                .appendingPathComponent("logs").path
                        )
                    ]
                )
            }
            Divider()
            Button("Quit Tunarr") {
                NSApplication.shared.terminate(nil)
            }
        }
    }
}
