//
//  main.swift
//  FfmpegCapabilities
//
//  Created by Christian Benincasa on 8/2/25.
//

import CoreFoundation
import Foundation
import VideoToolbox

extension FourCharCode {
    var string: String? {
        let cString: [CChar] = [
            CChar((self >> 24) & 0xFF),
            CChar((self >> 16) & 0xFF),
            CChar((self >> 8) & 0xFF),
            CChar(self & 0xFF),
            0,
        ]

        return String(cString: cString)
    }
}

func main() -> Int32 {
    var encoders: CFArray?
    let status = VTCopyVideoEncoderList(nil, &encoders)

    if status != noErr {
        print("Failed to get encoder list: \(status)")
        return 1
    }

    guard let encoderList = encoders as? [[String: Any]] else {
        print("Encoder list is not in the expected format.")
        return 1
    }

    var jsonEncoders: [[String: Any]] = []

    for encoder in encoderList {
        var jsonEncoder: [String: Any] = [:]

        let isHwAccel =
            encoder[kVTVideoEncoderList_IsHardwareAccelerated as String] as? Bool ?? false
        if !isHwAccel {
            continue
        }

        jsonEncoder["isHardwareAccelerated"] = true

        if let displayName = encoder[kVTVideoEncoderList_DisplayName as String]
            as? String
        {
            jsonEncoder["displayName"] = displayName
        }

        if let encoderName = encoder[kVTVideoEncoderList_EncoderName as String]
            as? String
        {
            jsonEncoder["encoderName"] = encoderName
        }

        if let encoderID = encoder[kVTVideoEncoderList_EncoderID as String]
            as? String
        {
            jsonEncoder["encoderID"] = encoderID
        }

        if let codecType = encoder[kVTVideoEncoderList_CodecType as String]
            as? CMVideoCodecType
        {
            jsonEncoder["codecType"] = (codecType as FourCharCode).string!
        }

        if let codecName = encoder[kVTVideoEncoderList_CodecName as String]
            as? String
        {
            jsonEncoder["codecName"] = codecName
        }

        if let supportedProps = encoder[kVTVideoEncoderList_SupportedSelectionProperties as String]
        {
            jsonEncoder["supportedProps"] = supportedProps
        }

        jsonEncoders.append(jsonEncoder)
    }

    let decoderSupport = [
        kCMVideoCodecType_H264,
        kCMVideoCodecType_HEVC,
        kCMVideoCodecType_AV1,
        kCMVideoCodecType_MPEG2Video,
        kCMVideoCodecType_MPEG4Video,
        kCMVideoCodecType_VP9,
    ]
    .reduce(
        into: [
            String: Bool
        ]()
    ) {
        $0[$1.string!] = VTIsHardwareDecodeSupported($1)
    }

    let jsonOutput: [String: Any] = [
        "encoders": jsonEncoders,
        "decoders": decoderSupport,
    ]

    // 4. Serialize the Swift dictionary into a JSON Data object.
    do {
        let jsonData = try JSONSerialization.data(
            withJSONObject: jsonOutput,
            options: [.prettyPrinted]
        )

        // 5. Convert the JSON Data to a String.
        if let jsonString = String(data: jsonData, encoding: .utf8) {
            print(jsonString)
        } else {
            print("Failed to convert JSON data to a string.")
            return 1
        }
    } catch {
        print("Failed to serialize encoder list to JSON: \(error)")
        return 1
    }

    return 0
}

exit(main())
