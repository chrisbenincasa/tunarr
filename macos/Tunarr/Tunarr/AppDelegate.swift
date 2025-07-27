//
//  AppDelegate.swift
//  Tunarr
//
//  Created by Christian Benincasa on 7/26/25.
//

import AppKit
import SwiftUI

class AppDelegate: NSObject, NSApplicationDelegate {
    let bundle = Bundle.main
    var task = Process()

    func applicationDidFinishLaunching(_ notification: Notification) {
        guard let executablePath = Bundle.main.url(forAuxiliaryExecutable: "tunarr-macos")
        else {
            /// TODO: Do a popup here.
            NSLog("Error: Bundled executable 'tunarr-macos' not found.")
            return
        }

        task.executableURL = executablePath
        do {
            try task.run()
            NSLog("Successfully started Tunarr subprocess.")
        } catch {
            NSLog("Could not launch Tunarr. Reason: \(error)")
        }
    }

    func applicationWillTerminate(_ aNotification: Notification) {
        NSLog("Shutting down Tunarr.")
        task.terminate()
        task.waitUntilExit()
    }
}
