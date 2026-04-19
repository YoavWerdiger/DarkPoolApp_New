import Foundation
import SwiftUI
import Combine
import Supabase

/// מצב מסך צ׳אט — קבוצות, הודעות, pagination, הקלדה, realtime.
@MainActor
public final class ChatSessionViewModel: ObservableObject {
    @Published public private(set) var groups: [ChatGroupListItem] = []
    @Published public private(set) var messages: [ChatMessageListItem] = []
    @Published public private(set) var selectedGroupId: String?
    @Published public private(set) var isLoadingGroups = false
    @Published public private(set) var isLoadingMessages = false
    @Published public private(set) var isLoadingOlder = false
    @Published public private(set) var hasMoreOlder = true
    @Published public private(set) var typingUserNames: [String] = []
    @Published public var replyDraftTo: ChatMessageListItem?
    @Published public var errorMessage: String?
    @Published public private(set) var storyStrip: [StoryStripItem] = []
    @Published public private(set) var isLoadingStories = false
    @Published public private(set) var searchResults: [ChatMessageListItem] = []
    @Published public private(set) var isSearching = false

    private let repository: ChatRepository
    private let pollRepository: PollRepository
    private let storiesRepository: StoriesRepository
    private let realtime: ChatRealtimeListener
    private let currentUserId: String
    private var typingTimer: Task<Void, Never>?

    public init(supabaseClient: SupabaseClient, currentUserId: String) {
        self.repository = ChatRepository(client: supabaseClient)
        self.pollRepository = PollRepository(client: supabaseClient)
        self.storiesRepository = StoriesRepository(client: supabaseClient)
        self.realtime = ChatRealtimeListener(client: supabaseClient)
        self.currentUserId = currentUserId
    }

    /// מזהה המשתמש המחובר (להשוואה מול חברי קבוצה).
    public var viewerId: String { currentUserId }

    public func signedURL(forMediaRef ref: String) async throws -> URL {
        try await repository.signedURLForChatMedia(ref: ref)
    }

    public func signedURLForStory(pathOrRef: String) async throws -> URL {
        try await storiesRepository.signedURLForStoryMedia(pathOrRef: pathOrRef)
    }

    public func loadStoryStrip() async {
        isLoadingStories = true
        defer { isLoadingStories = false }
        do {
            storyStrip = try await storiesRepository.fetchStoryStrip(currentUserId: currentUserId)
        } catch {
            storyStrip = []
        }
    }

    public func loadPoll(pollId: String) async throws -> PollWithVotes {
        try await pollRepository.getPollResults(pollId: pollId, userId: currentUserId)
    }

    public func voteOnPoll(pollId: String, optionIds: [String]) async throws {
        try await pollRepository.votePoll(pollId: pollId, optionIds: optionIds, userId: currentUserId)
    }

    public func sendImage(data: Data) async {
        guard let gid = selectedGroupId else { return }
        errorMessage = nil
        do {
            let path = try await repository.uploadChatImage(groupId: gid, data: data)
            try await repository.sendImageMessage(
                groupId: gid,
                senderId: currentUserId,
                mediaPath: path,
                replyToMessageId: replyDraftTo?.id
            )
            replyDraftTo = nil
            await refreshMessagesAfterSend(groupId: gid)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    public func sendVideo(data: Data) async {
        guard let gid = selectedGroupId else { return }
        errorMessage = nil
        do {
            let path = try await repository.uploadChatFile(
                groupId: gid,
                data: data,
                fileExtension: "mp4",
                contentType: "video/mp4"
            )
            try await repository.sendMediaMessage(
                groupId: gid,
                senderId: currentUserId,
                messageType: "video",
                mediaPath: path,
                mediaType: "video/mp4",
                mediaFileName: nil,
                mediaDuration: nil,
                mediaSize: data.count,
                replyToMessageId: replyDraftTo?.id
            )
            replyDraftTo = nil
            await refreshMessagesAfterSend(groupId: gid)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    public func sendDocument(data: Data, fileName: String) async {
        guard let gid = selectedGroupId else { return }
        errorMessage = nil
        let (ext, mime) = Self.mimeAndExtension(forFileName: fileName)
        do {
            let path = try await repository.uploadChatFile(
                groupId: gid,
                data: data,
                fileExtension: ext,
                contentType: mime
            )
            try await repository.sendMediaMessage(
                groupId: gid,
                senderId: currentUserId,
                messageType: "document",
                mediaPath: path,
                mediaType: mime,
                mediaFileName: fileName,
                mediaDuration: nil,
                mediaSize: data.count,
                replyToMessageId: replyDraftTo?.id
            )
            replyDraftTo = nil
            await refreshMessagesAfterSend(groupId: gid)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func refreshMessagesAfterSend(groupId: String) async {
        let fetched = try? await repository.fetchMessagesPage(
            groupId: groupId,
            currentUserId: currentUserId,
            limit: 50,
            before: nil
        )
        if let fetched {
            messages = fetched.sorted { $0.createdAt < $1.createdAt }
        }
        await markVisibleAsRead()
    }

    private static func mimeAndExtension(forFileName name: String) -> (String, String) {
        let ext = (name as NSString).pathExtension.lowercased()
        let safe = ext.isEmpty ? "bin" : ext
        let mime: String
        switch safe {
        case "pdf": mime = "application/pdf"
        case "doc", "docx": mime = "application/msword"
        case "xls", "xlsx": mime = "application/vnd.ms-excel"
        case "txt": mime = "text/plain"
        case "zip": mime = "application/zip"
        case "png": mime = "image/png"
        case "jpg", "jpeg": mime = "image/jpeg"
        case "mp3": mime = "audio/mpeg"
        case "m4a", "aac": mime = "audio/mp4"
        case "mp4", "mov": mime = "video/mp4"
        default: mime = "application/octet-stream"
        }
        return (safe, mime)
    }

    public func publishStory(imageData: Data) async {
        errorMessage = nil
        do {
            let path = try await storiesRepository.uploadStoryImage(data: imageData, userId: currentUserId)
            _ = try await storiesRepository.createStory(userId: currentUserId, mediaPath: path)
            await loadStoryStrip()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    public func markStoryViewed(storyId: String) async {
        try? await storiesRepository.markStoryViewed(storyId: storyId, viewerId: currentUserId)
    }

    public func fetchStoriesForUser(_ userId: String) async throws -> [UserStoryRow] {
        try await storiesRepository.fetchStoriesForUser(userId: userId)
    }

    public func searchInCurrentGroup(query: String) async {
        guard let gid = selectedGroupId else { return }
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else {
            searchResults = []
            return
        }
        isSearching = true
        defer { isSearching = false }
        do {
            searchResults = try await repository.searchMessagesInGroup(
                groupId: gid,
                currentUserId: currentUserId,
                query: q
            )
        } catch {
            searchResults = []
            errorMessage = error.localizedDescription
        }
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

    public func group(withId id: String) -> ChatGroupListItem? {
        groups.first { $0.id == id }
    }

    public func selectGroup(_ id: String?) async {
        selectedGroupId = id
        messages = []
        hasMoreOlder = true
        typingUserNames = []
        replyDraftTo = nil
        guard let id else {
            await realtime.unsubscribe()
            return
        }

        isLoadingMessages = true
        errorMessage = nil
        defer { isLoadingMessages = false }

        do {
            let fetched = try await repository.fetchMessagesPage(
                groupId: id,
                currentUserId: currentUserId,
                limit: 50,
                before: nil
            )
            messages = fetched.sorted { $0.createdAt < $1.createdAt }
            hasMoreOlder = fetched.count >= 50

            await realtime.unsubscribe()
            await realtime.subscribeToGroupMessages(groupId: id, currentUserId: currentUserId) { [weak self] newMessage in
                guard let self else { return }
                if newMessage.groupId != id { return }
                if self.messages.contains(where: { $0.id == newMessage.id }) { return }
                self.messages.append(newMessage)
                self.messages.sort { $0.createdAt < $1.createdAt }
            }

            await refreshTyping(for: id)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    public func loadOlderMessages() async {
        guard let gid = selectedGroupId, hasMoreOlder, !isLoadingOlder, !messages.isEmpty else { return }
        let oldest = messages.first?.createdAt
        isLoadingOlder = true
        defer { isLoadingOlder = false }
        do {
            let older = try await repository.fetchMessagesPage(
                groupId: gid,
                currentUserId: currentUserId,
                limit: 50,
                before: oldest
            )
            if older.isEmpty {
                hasMoreOlder = false
                return
            }
            let merged = (older + messages).uniqued(by: \.id).sorted { $0.createdAt < $1.createdAt }
            messages = merged
            hasMoreOlder = older.count >= 50
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    public func sendCurrentDraft(_ text: String) async {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, let gid = selectedGroupId else { return }
        errorMessage = nil
        do {
            try await repository.sendTextMessage(
                groupId: gid,
                senderId: currentUserId,
                text: trimmed,
                replyToMessageId: replyDraftTo?.id
            )
            replyDraftTo = nil
            let fetched = try await repository.fetchMessagesPage(
                groupId: gid,
                currentUserId: currentUserId,
                limit: 50,
                before: nil
            )
            messages = fetched.sorted { $0.createdAt < $1.createdAt }
            await markVisibleAsRead()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    public func toggleReaction(message: ChatMessageListItem, emoji: String) async {
        guard selectedGroupId != nil else { return }
        let hadMine = message.reactions.contains { $0.emoji == emoji && $0.reactedByMe }
        do {
            if hadMine {
                try await repository.removeReaction(messageId: message.id, emoji: emoji, userId: currentUserId)
            } else {
                try await repository.addReaction(messageId: message.id, emoji: emoji, userId: currentUserId)
            }
            let groups = try await repository.fetchReactionGroups(messageId: message.id, currentUserId: currentUserId)
            if let idx = messages.firstIndex(where: { $0.id == message.id }) {
                messages[idx] = messages[idx].withReactions(groups)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    public func editMessage(message: ChatMessageListItem, newText: String) async {
        let t = newText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty, let gid = selectedGroupId else { return }
        do {
            try await repository.editMessage(messageId: message.id, newContent: t)
            let enriched = try await repository.fetchMessageEnriched(messageId: message.id, groupId: gid, currentUserId: currentUserId)
            if let idx = messages.firstIndex(where: { $0.id == message.id }) {
                messages[idx] = enriched
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    public func deleteMessage(message: ChatMessageListItem, forEveryone: Bool) async {
        do {
            if forEveryone {
                try await repository.deleteMessageForEveryone(messageId: message.id)
            } else if let gid = selectedGroupId {
                try await repository.deleteMessageForMe(messageId: message.id, groupId: gid, userId: currentUserId)
            }
            messages.removeAll { $0.id == message.id }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    public func toggleStar(message: ChatMessageListItem) async {
        errorMessage = nil
        do {
            if message.isStarred {
                try await repository.unstarMessage(messageId: message.id, userId: currentUserId)
            } else {
                try await repository.starMessage(
                    messageId: message.id,
                    groupId: message.groupId,
                    userId: currentUserId
                )
            }
            if let idx = messages.firstIndex(where: { $0.id == message.id }) {
                messages[idx] = messages[idx].withStarred(!message.isStarred)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    public func forwardMessage(messageId: String, toGroupIds: [String]) async {
        let targets = Array(Set(toGroupIds)).filter { !$0.isEmpty }
        guard !targets.isEmpty else { return }
        errorMessage = nil
        do {
            try await repository.forwardMessage(userId: currentUserId, messageId: messageId, toGroupIds: targets)
            if let gid = selectedGroupId, targets.contains(gid) {
                let fetched = try await repository.fetchMessagesPage(
                    groupId: gid,
                    currentUserId: currentUserId,
                    limit: 50,
                    before: nil
                )
                messages = fetched.sorted { $0.createdAt < $1.createdAt }
                await markVisibleAsRead()
            }
            await loadGroups()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    public func setGroupMuted(groupId: String, muted: Bool) async {
        errorMessage = nil
        do {
            try await repository.setMemberMuted(groupId: groupId, userId: currentUserId, muted: muted)
            await loadGroups()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    public func leaveGroup(groupId: String) async {
        errorMessage = nil
        do {
            try await repository.removeSelfFromGroup(groupId: groupId, userId: currentUserId)
            if selectedGroupId == groupId {
                await selectGroup(nil)
            }
            await loadGroups()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    public func loadGroupMembers(groupId: String) async throws -> [ChatGroupMemberItem] {
        try await repository.fetchGroupMembers(groupId: groupId)
    }

    public func updateGroupName(groupId: String, name: String) async {
        errorMessage = nil
        do {
            try await repository.updateChatGroupName(groupId: groupId, editorUserId: currentUserId, name: name)
            await loadGroups()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    public func updateGroupDescription(groupId: String, text: String) async {
        errorMessage = nil
        do {
            try await repository.updateChatGroupDescription(groupId: groupId, editorUserId: currentUserId, description: text)
            await loadGroups()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    public func promoteToAdmin(groupId: String, memberUserId: String) async {
        errorMessage = nil
        do {
            try await repository.updateGroupMemberRole(
                groupId: groupId,
                memberUserId: memberUserId,
                newRole: "admin",
                actingUserId: currentUserId
            )
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    public func demoteToMember(groupId: String, memberUserId: String) async {
        errorMessage = nil
        do {
            try await repository.updateGroupMemberRole(
                groupId: groupId,
                memberUserId: memberUserId,
                newRole: "member",
                actingUserId: currentUserId
            )
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    public func removeMemberAsAdmin(groupId: String, memberUserId: String) async {
        errorMessage = nil
        do {
            try await repository.removeGroupMemberByAdmin(
                groupId: groupId,
                memberUserId: memberUserId,
                actingUserId: currentUserId
            )
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    public func userTypedInComposer(_ text: String) {
        guard let gid = selectedGroupId else { return }
        typingTimer?.cancel()
        let has = !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        typingTimer = Task {
            do {
                try await repository.setTyping(groupId: gid, userId: currentUserId, isTyping: has)
            } catch { /* ignore */ }
            if has {
                try? await Task.sleep(nanoseconds: 4_000_000_000)
                try? await repository.setTyping(groupId: gid, userId: currentUserId, isTyping: false)
            }
        }
    }

    public func markVisibleAsRead() async {
        guard let gid = selectedGroupId, let last = messages.last else { return }
        do {
            try await repository.markMessagesAsRead(groupId: gid, messageIds: [last.id], userId: currentUserId)
            await loadGroups()
        } catch { /* ignore */ }
    }

    private func refreshTyping(for groupId: String) async {
        do {
            typingUserNames = try await repository.fetchTypingDisplayNames(groupId: groupId, excludingUserId: currentUserId)
        } catch {
            typingUserNames = []
        }
    }

    public func stopRealtime() async {
        typingTimer?.cancel()
        await realtime.unsubscribe()
    }
}

private extension [ChatMessageListItem] {
    func uniqued(by keyPath: KeyPath<ChatMessageListItem, String>) -> [ChatMessageListItem] {
        var seen = Set<String>()
        return filter { seen.insert($0[keyPath: keyPath]).inserted }
    }
}
