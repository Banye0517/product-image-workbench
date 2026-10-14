import Foundation
import Vision
import CoreImage
import ImageIO
import UniformTypeIdentifiers

@available(macOS 14.0, *)
func cutout(_ source: String, _ destination: String) throws {
    guard let image = CIImage(contentsOf: URL(fileURLWithPath: source), options: [.applyOrientationProperty: true]) else { throw NSError(domain: "Image", code: 1) }
    let request = VNGenerateForegroundInstanceMaskRequest()
    let handler = VNImageRequestHandler(ciImage: image)
    try handler.perform([request])
    guard let result = request.results?.first, !result.allInstances.isEmpty else { throw NSError(domain: "NoForeground", code: 2) }
    let mask = try result.generateScaledMaskForImage(forInstances: result.allInstances, from: handler)
    let maskImage = CIImage(cvPixelBuffer: mask)
    let clear = CIImage(color: .clear).cropped(to: image.extent)
    let output = image.applyingFilter("CIBlendWithMask", parameters: [kCIInputBackgroundImageKey: clear, kCIInputMaskImageKey: maskImage])
    let context = CIContext()
    try context.writePNGRepresentation(of: output, to: URL(fileURLWithPath: destination), format: .RGBA8, colorSpace: CGColorSpaceCreateDeviceRGB())
}
do {
    guard CommandLine.arguments.count == 3 else { exit(2) }
    if #available(macOS 14.0, *) { try cutout(CommandLine.arguments[1], CommandLine.arguments[2]) } else { exit(3) }
} catch { fputs("Foreground segmentation failed\n", stderr); exit(1) }
