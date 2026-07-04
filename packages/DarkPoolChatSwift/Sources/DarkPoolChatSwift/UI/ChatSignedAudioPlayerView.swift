import AVFoundation
import SwiftUI

/// נגן אודיו / קול מ־`chat-media` עם URL חתום.
public struct ChatSignedAudioPlayerView: View {
    let mediaRef: String
    let durationSeconds: Int?
    let isFromCurrentUser: Bool
    @ObservedObject var model: ChatSessionViewModel

    @State private var url: URL?
    @State private var player: AVPlayer?
    @State private var isPlaying = false

    public init(
        mediaRef: String,
        durationSeconds: Int?,
        isFromCurrentUser: Bool,
        model: ChatSessionViewModel
    ) {
        self.mediaRef = mediaRef
        self.durationSeconds = durationSeconds
        self.isFromCurrentUser = isFromCurrentUser
        self.model = model
    }

    public var body: some View {
        HStack(spacing: ChatDesignTokens.Spacing.md) {
            Button {
                togglePlay()
            } label: {
                Image(systemName: isPlaying ? "pause.circle.fill" : "play.circle.fill")
                    .font(.system(size: 36))
                    .foregroundStyle(playTint)
            }
            .buttonStyle(.plain)
            .disabled(player == nil && url == nil)

            VStack(alignment: .leading, spacing: 4) {
                Text("הודעת קול")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(isFromCurrentUser ? Color.white.opacity(0.95) : Color.primary)
                if let d = durationSeconds, d > 0 {
                    Text(formatDuration(d))
                        .font(.caption2)
                        .foregroundStyle(isFromCurrentUser ? Color.white.opacity(0.75) : Color.secondary)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, ChatDesignTokens.Spacing.xs)
        .task(id: mediaRef) {
            url = try? await model.signedURL(forMediaRef: mediaRef)
            if let url {
                player = AVPlayer(url: url)
            }
        }
        .onDisappear {
            player?.pause()
            player = nil
            isPlaying = false
        }
    }

    private var playTint: Color {
        isFromCurrentUser ? .white : ChatDesignTokens.brand
    }

    private func togglePlay() {
        guard let p = player else { return }
        if isPlaying {
            p.pause()
            isPlaying = false
        } else {
            p.play()
            isPlaying = true
        }
    }

    private func formatDuration(_ sec: Int) -> String {
        let m = sec / 60
        let s = sec % 60
        return String(format: "%d:%02d", m, s)
    }
}
