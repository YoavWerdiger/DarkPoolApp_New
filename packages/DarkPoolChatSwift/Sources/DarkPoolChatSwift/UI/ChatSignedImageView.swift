import SwiftUI

/// תמונת צ׳אט מ־`chat-media` עם URL חתום (bucket פרטי).
public struct ChatSignedImageView: View {
    let mediaRef: String
    @ObservedObject var model: ChatSessionViewModel

    @State private var url: URL?

    public init(mediaRef: String, model: ChatSessionViewModel) {
        self.mediaRef = mediaRef
        self.model = model
    }

    public var body: some View {
        Group {
            if let url {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let img):
                        img
                            .resizable()
                            .scaledToFit()
                            .frame(maxHeight: 220)
                            .cornerRadius(10)
                    case .failure:
                        Text("לא ניתן לטעון תמונה")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    case .empty:
                        ProgressView()
                    @unknown default:
                        EmptyView()
                    }
                }
            } else {
                ProgressView()
            }
        }
        .task(id: mediaRef) {
            url = try? await model.signedURL(forMediaRef: mediaRef)
        }
    }
}
