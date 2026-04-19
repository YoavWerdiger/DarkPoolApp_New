import SwiftUI

/// קישור למסמך ב־`chat-media` (URL חתום) — פותח במערכת.
public struct ChatSignedDocumentView: View {
    let mediaRef: String
    let fileName: String?
    let isFromCurrentUser: Bool
    @ObservedObject var model: ChatSessionViewModel

    @State private var url: URL?

    public init(
        mediaRef: String,
        fileName: String?,
        isFromCurrentUser: Bool,
        model: ChatSessionViewModel
    ) {
        self.mediaRef = mediaRef
        self.fileName = fileName
        self.isFromCurrentUser = isFromCurrentUser
        self.model = model
    }

    private var displayName: String {
        let n = fileName?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let n, !n.isEmpty { return n }
        return "מסמך"
    }

    public var body: some View {
        Group {
            if let url {
                Link(destination: url) {
                    HStack(spacing: ChatDesignTokens.Spacing.sm) {
                        Image(systemName: "doc.fill")
                        Text(displayName)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)
                        Image(systemName: "arrow.up.forward.square")
                            .font(.caption)
                    }
                    .foregroundStyle(isFromCurrentUser ? Color.white : ChatDesignTokens.brand)
                }
            } else {
                ProgressView()
                    .tint(isFromCurrentUser ? .white : ChatDesignTokens.brand)
            }
        }
        .task(id: mediaRef) {
            url = try? await model.signedURL(forMediaRef: mediaRef)
        }
    }
}
