import SwiftUI
import UniformTypeIdentifiers

#if os(iOS)
import UIKit

/// בחירת מסמך לצ׳אט (iOS) — `Data` + שם קובץ.
public struct ChatDocumentPicker: UIViewControllerRepresentable {
    var onDocument: (Data?, String?) -> Void

    public init(onDocument: @escaping (Data?, String?) -> Void) {
        self.onDocument = onDocument
    }

    public func makeCoordinator() -> Coordinator {
        Coordinator(onDocument: onDocument)
    }

    public func makeUIViewController(context: Context) -> UIDocumentPickerViewController {
        let types: [UTType] = [.item, .data, .content, .pdf, .text, .plainText, .image, .movie, .audio]
        let c = UIDocumentPickerViewController(forOpeningContentTypes: types, asCopy: true)
        c.delegate = context.coordinator
        c.allowsMultipleSelection = false
        return c
    }

    public func updateUIViewController(_ uiViewController: UIDocumentPickerViewController, context: Context) {}

    public final class Coordinator: NSObject, UIDocumentPickerDelegate {
        let onDocument: (Data?, String?) -> Void

        init(onDocument: @escaping (Data?, String?) -> Void) {
            self.onDocument = onDocument
        }

        public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
            onDocument(nil, nil)
        }

        public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
            guard let url = urls.first else {
                onDocument(nil, nil)
                return
            }
            let name = url.lastPathComponent
            let accessing = url.startAccessingSecurityScopedResource()
            defer {
                if accessing { url.stopAccessingSecurityScopedResource() }
            }
            do {
                let data = try Data(contentsOf: url)
                onDocument(data, name)
            } catch {
                onDocument(nil, nil)
            }
        }
    }
}
#endif
