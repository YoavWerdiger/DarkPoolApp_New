import SwiftUI

#if os(iOS)
import UIKit

/// בורר תמונה מהגלריה — לצ׳אט ולסטוריז (iOS).
public struct ChatPhotoLibraryPicker: UIViewControllerRepresentable {
    var onImage: (Data?) -> Void

    public init(onImage: @escaping (Data?) -> Void) {
        self.onImage = onImage
    }

    public func makeCoordinator() -> Coordinator {
        Coordinator(onImage: onImage)
    }

    public func makeUIViewController(context: Context) -> UIImagePickerController {
        let p = UIImagePickerController()
        p.sourceType = .photoLibrary
        p.delegate = context.coordinator
        p.allowsEditing = false
        return p
    }

    public func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    public final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let onImage: (Data?) -> Void

        init(onImage: @escaping (Data?) -> Void) {
            self.onImage = onImage
        }

        public func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            onImage(nil)
        }

        public func imagePickerController(
            _ picker: UIImagePickerController,
            didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
        ) {
            let img = info[.originalImage] as? UIImage
            let data = img?.jpegData(compressionQuality: 0.85)
            onImage(data)
        }
    }
}
#endif
