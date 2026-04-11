import SwiftUI

/// UI בסיסי (iOS 15+) — רשימת קבוצות ומסך שיחה.
public struct ChatRootView: View {
    @ObservedObject private var model: ChatSessionViewModel
    @State private var draft = ""

    public init(model: ChatSessionViewModel) {
        self.model = model
    }

    public var body: some View {
        NavigationView {
            List(model.groups) { g in
                NavigationLink {
                    ConversationPane(model: model, groupId: g.id, draft: $draft)
                        .navigationTitle(g.name)
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(g.name)
                                .font(.headline)
                            if let p = g.lastMessagePreview {
                                Text(p)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                    .lineLimit(1)
                            }
                        }
                        Spacer()
                        if g.unreadCount > 0 {
                            Text("\(g.unreadCount)")
                                .font(.caption2)
                                .padding(6)
                                .background(Capsule().fill(Color.accentColor.opacity(0.2)))
                        }
                    }
                }
            }
            .navigationTitle("צ׳אטים")
            .task {
                await model.loadGroups()
            }

            Text("בחר קבוצה")
                .foregroundColor(.secondary)
        }
        #if os(iOS)
        .navigationViewStyle(.stack)
        #endif
    }
}

private struct ConversationPane: View {
    @ObservedObject var model: ChatSessionViewModel
    let groupId: String
    @Binding var draft: String

    var body: some View {
        VStack(spacing: 0) {
            if let err = model.errorMessage {
                Text(err)
                    .font(.caption)
                    .foregroundColor(.red)
                    .padding(8)
            }
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 8) {
                        ForEach(model.messages) { m in
                            messageRow(m)
                                .id(m.id)
                        }
                    }
                    .padding()
                }
                .onChange(of: model.messages.count) { _ in
                    if let last = model.messages.last {
                        withAnimation {
                            proxy.scrollTo(last.id, anchor: .bottom)
                        }
                    }
                }
            }
            HStack {
                TextField("הודעה", text: $draft)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                Button("שלח") {
                    Task {
                        await model.sendCurrentDraft(draft)
                        draft = ""
                    }
                }
                .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            .padding()
        }
        .task(id: groupId) {
            await model.selectGroup(groupId)
        }
        .onDisappear {
            Task { await model.stopRealtime() }
        }
    }

    @ViewBuilder
    private func messageRow(_ m: ChatMessageListItem) -> some View {
        HStack {
            if m.isFromCurrentUser { Spacer(minLength: 40) }
            VStack(alignment: m.isFromCurrentUser ? .trailing : .leading, spacing: 4) {
                if !m.isFromCurrentUser {
                    Text(m.senderDisplayName)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
                Text(m.content ?? "")
                    .padding(10)
                    .background(m.isFromCurrentUser ? Color.accentColor.opacity(0.25) : Color.gray.opacity(0.18))
                    .cornerRadius(12)
            }
            if !m.isFromCurrentUser { Spacer(minLength: 40) }
        }
    }
}
