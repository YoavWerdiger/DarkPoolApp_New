import AVKit
import SwiftUI

/// וידאו מ־`chat-media` עם URL חתום (bucket פרטי).
public struct ChatSignedVideoView: View {
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
                VideoPlayer(player: AVPlayer(url: url))
                    .frame(maxHeight: 220)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            } else {
                ProgressView()
            }
        }
        .task(id: mediaRef) {
            url = try? await model.signedURL(forMediaRef: mediaRef)
        }
    }
}
