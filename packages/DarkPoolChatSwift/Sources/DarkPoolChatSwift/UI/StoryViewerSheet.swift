import SwiftUI

/// צפייה בסטוריז של משתמש (גרסה מצומצמת לעומת RN).
public struct StoryViewerSheet: View {
    let userId: String
    @ObservedObject var model: ChatSessionViewModel
    var onDismiss: () -> Void

    @State private var stories: [UserStoryRow] = []
    @State private var index = 0
    @State private var loading = true
    @State private var signedURLs: [String: URL] = [:]

    public init(userId: String, model: ChatSessionViewModel, onDismiss: @escaping () -> Void) {
        self.userId = userId
        self.model = model
        self.onDismiss = onDismiss
    }

    public var body: some View {
        NavigationView {
            ZStack {
                if loading {
                    ProgressView()
                } else if stories.isEmpty {
                    Text("אין סטוריז")
                        .foregroundColor(.secondary)
                } else {
                    TabView(selection: $index) {
                        ForEach(Array(stories.enumerated()), id: \.element.id) { i, s in
                            storyPage(s)
                                .tag(i)
                        }
                    }
                    #if os(iOS)
                    .tabViewStyle(.page(indexDisplayMode: .automatic))
                    #endif
                }
            }
            .navigationTitle("סטורי")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("סגור") { onDismiss() }
                }
            }
        }
        .task(id: userId) {
            await load()
        }
    }

    @ViewBuilder
    private func storyPage(_ s: UserStoryRow) -> some View {
        VStack {
            if s.media_type == "image", s.media_url != nil, let url = signedURLs[s.id] {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let img):
                        img.resizable().scaledToFit()
                    case .failure:
                        Text("שגיאת טעינה")
                    case .empty:
                        ProgressView()
                    @unknown default:
                        EmptyView()
                    }
                }
            } else if let c = s.content { Text(c)
            } else {
                Text("לא ניתן להציג")
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.black.opacity(0.9))
        .foregroundColor(.white)
        .onAppear {
            Task { await model.markStoryViewed(storyId: s.id) }
        }
    }

    private func load() async {
        loading = true
        defer { loading = false }
        do {
            let list = try await model.fetchStoriesForUser(userId)
            stories = list
            for s in list {
                guard s.media_type == "image", let path = s.media_url else { continue }
                if let u = try? await model.signedURLForStory(pathOrRef: path) {
                    signedURLs[s.id] = u
                }
            }
        } catch {
            stories = []
        }
    }
}
