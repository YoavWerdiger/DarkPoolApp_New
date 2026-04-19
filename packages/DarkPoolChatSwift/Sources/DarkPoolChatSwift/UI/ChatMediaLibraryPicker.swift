import SwiftUI

#if os(iOS)
import UIKit
import MobileCoreServices

/// תוצאה מבורר גלריה — תמונה או וידאו (לצ׳אט).
public enum ChatMediaLibraryPickResult: Sendable {
    case image(Data)
    case video(Data)
    case cancelled
}

/// בורר תמונה + וידאו מהגלריה (iOS).
public struct ChatMediaLibraryPicker: UIViewControllerRepresentable {
    var onPick: (ChatMediaLibraryPickResult) -> Void

    public init(onPick: @escaping (ChatMediaLibraryPickResult) -> Void) {
        self.onPick = onPick
    }

    public func makeCoordinator() -> Coordinator {
        Coordinator(onPick: onPick)
    }

    public func makeUIViewController(context: Context) -> UIImagePickerController {
        let p = UIImagePickerController()
        p.sourceType = .photoLibrary
        p.delegate = context.coordinator
        p.allowsEditing = false
        p.videoQuality = .typeMedium
        p.mediaTypes = [
            kUTTypeImage as String,
            kUTTypeMovie as String,
        ]
        return p
    }

    public func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    public final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let onPick: (ChatMediaLibraryPickResult) -> Void

        init(onPick: @escaping (ChatMediaLibraryPickResult) -> Void) {
            self.onPick = onPick
        }

        public func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            onPick(.cancelled)
        }

        public func imagePickerController(
            _ picker: UIImagePickerController,
            didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
        ) {
            if let url = info[.mediaURL] as? URL {
                do {
                    let data = try Data(contentsOf: url)
                    onPick(.video(data))
                } catch {
                    onPick(.cancelled)
                }
                return
            }
            let img = info[.originalImage] as? UIImage
            let data = img?.jpegData(compressionQuality: 0.85)
            if let data {
                onPick(.image(data))
            } else {
                onPick(.cancelled)
            }
        }
    }
}
#endif
