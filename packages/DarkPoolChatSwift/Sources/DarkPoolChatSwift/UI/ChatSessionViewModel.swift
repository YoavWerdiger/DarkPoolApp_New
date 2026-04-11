import Foundation
import SwiftUI
import Combine
import Supabase

/// מצב מסך צ׳אט — רשימת קבוצות, הודעות בקבוצה נבחרת, ומנוי Realtime.
@MainActor
public final class ChatSessionViewModel: ObservableObject {
    @Published public private(set) var groups: [ChatGroupListItem] = []
    @Published public private(set) var messages: [ChatMessageListItem] = []
    @Published public private(set) var selectedGroupId: String?
    @Published public private(set) var isLoadingGroups = false
    @Published public private(set) var isLoadingMessages = false
    @Published public var errorMessage: String?

    private let repository: ChatRepository
    private let realtime: ChatRealtimeListener
    private let currentUserId: String

    public init(supabaseClient: SupabaseClient, currentUserId: String) {
        self.repository = ChatRepository(client: supabaseClient)
        self.realtime = ChatRealtimeListener(client: supabaseClient)
        self.currentUserId = currentUserId
    }

    public func loadGroups() async {
        isLoadingGroups = true
        errorMessage = nil
        defer { isLoadingGroups = false }
        do {
            groups = try await repository.fetchGroups(userId: currentUserId)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    public func selectGroup(_ id: String?) async {
        selectedGroupId = id
        messages = []
        guard let id else { return }

        isLoadingMessages = true
        errorMessage = nil
        defer { isLoadingMessages = false }

        do {
            let fetched = try await repository.fetchMessages(
                groupId: id,
                currentUserId: currentUserId,
                limit: 50,
                offset: 0
            )
            messages = fetched.sorted { $0.createdAt < $1.createdAt }

            await realtime.unsubscribe()
            await realtime.subscribeToGroupMessages(groupId: id, currentUserId: currentUserId) { [weak self] newMessage in
                guard let self else { return }
                if newMessage.groupId != id { return }
                if self.messages.contains(where: { $0.id == newMessage.id }) { return }
                self.messages.append(newMessage)
                self.messages.sort { $0.createdAt < $1.createdAt }
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    public func sendCurrentDraft(_ text: String) async {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, let gid = selectedGroupId else { return }
        errorMessage = nil
        do {
            try await repository.sendTextMessage(groupId: gid, senderId: currentUserId, text: trimmed)
            let fetched = try await repository.fetchMessages(
                groupId: gid,
                currentUserId: currentUserId,
                limit: 50,
                offset: 0
            )
            messages = fetched.sorted { $0.createdAt < $1.createdAt }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    public func stopRealtime() async {
        await realtime.unsubscribe()
    }
}
