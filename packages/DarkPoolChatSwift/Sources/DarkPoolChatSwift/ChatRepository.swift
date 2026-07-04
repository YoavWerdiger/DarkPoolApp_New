import Foundation
import Supabase
import Storage

public enum ChatRepositoryError: Error, Sendable {
    case supabase(String)
    case decoding
}

/// שכבת גישה ל־PostgREST — תואם ל־`chatMessageService` / `chatGroupService` ב־RN.
public final class ChatRepository: @unchecked Sendable {
    private let client: SupabaseClient

    public init(configuration: DarkPoolChatConfiguration) {
        self.client = configuration.makeClient()
    }

    public init(client: SupabaseClient) {
        self.client = client
    }

    private static let groupSelect = """
    group_id,
    role,
    muted,
    unread_count,
    mentioned_count,
    last_read_message_id,
    chat_groups (
      id,
      name,
      description,
      avatar_url,
      created_by,
      created_at,
      updated_at,
      members_count,
      messages_count,
      last_message_at,
      last_message_preview,
      settings
    )
    """

    private static let messageSelect = """
    *,
    sender:users!chat_messages_sender_id_fkey (
      id,
      display_name,
      profile_picture,
      is_online
    )
    """

    private static let replySelect = """
    id,
    content,
    message_type,
    sender_id,
    sender:users!chat_messages_sender_id_fkey (
      id,
      display_name
    )
    """

    // MARK: - קבוצות

    public func fetchGroups(userId: String) async throws -> [ChatGroupListItem] {
        let rows: [ChatGroupMemberRow] = try await client
            .from("chat_group_members")
            .select(Self.groupSelect)
            .eq("user_id", value: userId)
            .order("last_read_at", ascending: false)
            .execute()
            .value

        return ChatDTOMapper.mapGroups(rows)
    }

    // MARK: - הודעות (עם ריאקציות, קריאה, כוכב, מחיקה אישית, reply)

    /// טעינת עמוד הודעות — `before` = תאריך ההודעה הישנה ביותר שכבר יש (לטעינת ישנות יותר).
    public func fetchMessagesPage(
        groupId: String,
        currentUserId: String,
        limit: Int = 50,
        before: Date? = nil
    ) async throws -> [ChatMessageListItem] {
        var base = client
            .from("chat_messages")
            .select(Self.messageSelect)
            .eq("group_id", value: groupId)
            .eq("is_deleted", value: false)

        if let before {
            let s = ISO8601DateFormatter().string(from: before)
            base = base.lt("created_at", value: s)
        }

        let rows: [ChatMessageDTO] = try await base
            .order("created_at", ascending: false)
            .limit(limit)
            .execute()
            .value

        return try await enrichMessageRows(rows, groupId: groupId, currentUserId: currentUserId)
    }

    private func enrichMessageRows(
        _ rows: [ChatMessageDTO],
        groupId: String,
        currentUserId: String
    ) async throws -> [ChatMessageListItem] {
        guard !rows.isEmpty else { return [] }

        let messageIds = rows.map(\.id)
        let replyIds = rows.compactMap(\.reply_to_message_id).uniqued()

        async let reactionsTask: [ChatReactionRow] = {
            try await client
                .from("chat_message_reactions")
                .select("message_id, user_id, emoji, user:users (id, display_name, profile_picture)")
                .in("message_id", values: messageIds)
                .execute()
                .value
        }()

        async let starredTask: [StarredRow] = {
            try await client
                .from("chat_starred_messages")
                .select("message_id")
                .eq("user_id", value: currentUserId)
                .in("message_id", values: messageIds)
                .execute()
                .value
        }()

        async let readTask: [ReadRow] = {
            try await client
                .from("chat_message_reads")
                .select("message_id")
                .eq("user_id", value: currentUserId)
                .in("message_id", values: messageIds)
                .execute()
                .value
        }()

        async let deletedTask: [DeletedRow] = {
            try await client
                .from("chat_message_personal_deletions")
                .select("message_id")
                .eq("user_id", value: currentUserId)
                .in("message_id", values: messageIds)
                .execute()
                .value
        }()

        let reactionsRows = try await reactionsTask
        let starredRows = try await starredTask
        let readRows = try await readTask
        let deletedRows = try await deletedTask

        let reactionGroups = ChatDTOMapper.reactionGroups(from: reactionsRows, currentUserId: currentUserId)
        let starredIds = Set(starredRows.map(\.message_id))
        let readIds = Set(readRows.map(\.message_id))
        let deletedIds = Set(deletedRows.map(\.message_id))

        var replyMap: [String: ReplyPreview] = [:]
        if !replyIds.isEmpty {
            let replyRows: [ReplyMessageRow] = try await client
                .from("chat_messages")
                .select(Self.replySelect)
                .in("id", values: Array(replyIds))
                .execute()
                .value
            for r in replyRows {
                let name = r.sender?.display_name ?? "משתמש"
                let preview: String? = {
                    if r.message_type == "text" { return r.content }
                    return "[\(r.message_type)]"
                }()
                replyMap[r.id] = ReplyPreview(messageId: r.id, senderName: name, contentPreview: preview)
            }
        }

        return ChatDTOMapper.enrichMessages(
            rows,
            currentUserId: currentUserId,
            reactionsByMessage: reactionGroups,
            readIds: readIds,
            starredIds: starredIds,
            replyMap: replyMap,
            deletedIds: deletedIds
        )
    }

    private struct StarredRow: Decodable, Sendable {
        let message_id: String
    }

    private struct ReadRow: Decodable, Sendable {
        let message_id: String
    }

    private struct DeletedRow: Decodable, Sendable {
        let message_id: String
    }

    private struct ReplyMessageRow: Decodable, Sendable {
        let id: String
        let content: String?
        let message_type: String
        let sender_id: String
        let sender: ChatSenderDTO?
    }

    public func fetchMessageById(_ messageId: String) async throws -> ChatMessageDTO {
        let rows: [ChatMessageDTO] = try await client
            .from("chat_messages")
            .select(Self.messageSelect)
            .eq("id", value: messageId)
            .limit(1)
            .execute()
            .value

        guard let first = rows.first else {
            throw ChatRepositoryError.supabase("Message not found")
        }
        return first
    }

    /// הודעה אחת מלאה (אחרי Realtime).
    public func fetchMessageEnriched(messageId: String, groupId: String, currentUserId: String) async throws -> ChatMessageListItem {
        let dto = try await fetchMessageById(messageId)
        let list = try await enrichMessageRows([dto], groupId: groupId, currentUserId: currentUserId)
        guard let first = list.first else {
            throw ChatRepositoryError.decoding
        }
        return first
    }

    public func fetchReactionGroups(messageId: String, currentUserId: String) async throws -> [ReactionGroup] {
        let rows: [ChatReactionRow] = try await client
            .from("chat_message_reactions")
            .select("message_id, user_id, emoji, user:users (id, display_name, profile_picture)")
            .eq("message_id", value: messageId)
            .execute()
            .value
        let map = ChatDTOMapper.reactionGroups(from: rows, currentUserId: currentUserId)
        return map[messageId] ?? []
    }

    // MARK: - שליחה / עריכה / מחיקה

    public func sendTextMessage(
        groupId: String,
        senderId: String,
        text: String,
        replyToMessageId: String? = nil
    ) async throws {
        struct InsertBody: Encodable {
            let group_id: String
            let sender_id: String
            let content: String
            let message_type: String
            let mentioned_users: [String]
            let is_silent: Bool
            let reply_to_message_id: String?
        }

        let body = InsertBody(
            group_id: groupId,
            sender_id: senderId,
            content: text,
            message_type: "text",
            mentioned_users: [],
            is_silent: false,
            reply_to_message_id: replyToMessageId
        )

        try await client
            .from("chat_messages")
            .insert(body)
            .execute()
    }

    public func editMessage(messageId: String, newContent: String) async throws {
        struct Patch: Encodable {
            let content: String
            let is_edited: Bool
            let edited_at: String
        }
        let patch = Patch(
            content: newContent,
            is_edited: true,
            edited_at: ISO8601DateFormatter().string(from: Date())
        )
        try await client
            .from("chat_messages")
            .update(patch)
            .eq("id", value: messageId)
            .execute()
    }

    public func deleteMessageForEveryone(messageId: String) async throws {
        struct Patch: Encodable {
            let is_deleted: Bool
            let deleted_at: String
            let deleted_for_everyone: Bool
            let content: String?
            let media_url: String?
        }
        let patch = Patch(
            is_deleted: true,
            deleted_at: ISO8601DateFormatter().string(from: Date()),
            deleted_for_everyone: true,
            content: nil,
            media_url: nil
        )
        try await client
            .from("chat_messages")
            .update(patch)
            .eq("id", value: messageId)
            .execute()
    }

    public func deleteMessageForMe(messageId: String, groupId: String, userId: String) async throws {
        struct Ins: Encodable {
            let message_id: String
            let user_id: String
            let group_id: String
        }
        try await client
            .from("chat_message_personal_deletions")
            .insert(Ins(message_id: messageId, user_id: userId, group_id: groupId))
            .execute()
    }

    // MARK: - ריאקציות

    public func addReaction(messageId: String, emoji: String, userId: String) async throws {
        struct Ins: Encodable {
            let message_id: String
            let user_id: String
            let emoji: String
        }
        do {
            try await client
                .from("chat_message_reactions")
                .insert(Ins(message_id: messageId, user_id: userId, emoji: emoji))
                .execute()
        } catch {
            // duplicate unique — מתעלמים כמו ב־RN
        }
    }

    public func removeReaction(messageId: String, emoji: String, userId: String) async throws {
        try await client
            .from("chat_message_reactions")
            .delete()
            .eq("message_id", value: messageId)
            .eq("user_id", value: userId)
            .eq("emoji", value: emoji)
            .execute()
    }

    // MARK: - קריאה

    public func markMessagesAsRead(groupId: String, messageIds: [String], userId: String) async throws {
        guard !messageIds.isEmpty else { return }

        struct ReadIns: Encodable {
            let message_id: String
            let user_id: String
            let group_id: String
        }

        let reads = messageIds.map { ReadIns(message_id: $0, user_id: userId, group_id: groupId) }
        try await client
            .from("chat_message_reads")
            .upsert(reads)
            .execute()

        if let last = messageIds.last {
            struct MemberReadUpdate: Encodable {
                let last_read_message_id: String
                let last_read_at: String
                let unread_count: Int
            }
            let upd = MemberReadUpdate(
                last_read_message_id: last,
                last_read_at: ISO8601DateFormatter().string(from: Date()),
                unread_count: 0
            )
            try await client
                .from("chat_group_members")
                .update(upd)
                .eq("group_id", value: groupId)
                .eq("user_id", value: userId)
                .execute()
        }
    }

    // MARK: - הקלדה

    public func setTyping(groupId: String, userId: String, isTyping: Bool) async throws {
        if isTyping {
            struct TypingUpsert: Encodable {
                let group_id: String
                let user_id: String
                let started_typing_at: String
            }
            let row = TypingUpsert(
                group_id: groupId,
                user_id: userId,
                started_typing_at: ISO8601DateFormatter().string(from: Date())
            )
            try await client
                .from("chat_typing_indicators")
                .upsert(row)
                .execute()
        } else {
            try await client
                .from("chat_typing_indicators")
                .delete()
                .eq("group_id", value: groupId)
                .eq("user_id", value: userId)
                .execute()
        }
    }

    public func fetchTypingDisplayNames(groupId: String, excludingUserId: String) async throws -> [String] {
        struct Row: Decodable {
            let user: ChatSenderDTO?
        }
        let rows: [Row] = try await client
            .from("chat_typing_indicators")
            .select("user:users (display_name)")
            .eq("group_id", value: groupId)
            .neq("user_id", value: excludingUserId)
            .execute()
            .value
        return rows.compactMap { $0.user?.display_name }
    }

    // MARK: - מדיה (bucket `chat-media`, כמו RN)

    private static let chatMediaBucket = "chat-media"

    public func signedURLForChatMedia(ref: String) async throws -> URL {
        if let path = ChatMediaURL.storagePath(from: ref) {
            return try await client.storage.from(Self.chatMediaBucket).createSignedURL(path: path, expiresIn: 3600)
        }
        if ref.hasPrefix("http://") || ref.hasPrefix("https://"), let u = URL(string: ref) {
            return u
        }
        throw ChatRepositoryError.supabase("Invalid media ref")
    }

    public func uploadChatImage(groupId: String, data: Data) async throws -> String {
        let name = "\(Int(Date().timeIntervalSince1970 * 1000))-\(UUID().uuidString.prefix(8)).jpg"
        let path = "\(groupId)/\(name)"
        let opts = FileOptions(contentType: "image/jpeg", upsert: false)
        _ = try await client.storage.from(Self.chatMediaBucket).upload(path, data: data, options: opts)
        return path
    }

    public func sendImageMessage(
        groupId: String,
        senderId: String,
        mediaPath: String,
        replyToMessageId: String? = nil
    ) async throws {
        struct InsertBody: Encodable {
            let group_id: String
            let sender_id: String
            let content: String?
            let message_type: String
            let media_url: String
            let media_type: String
            let mentioned_users: [String]
            let is_silent: Bool
            let reply_to_message_id: String?
        }

        let body = InsertBody(
            group_id: groupId,
            sender_id: senderId,
            content: nil,
            message_type: "image",
            media_url: mediaPath,
            media_type: "image",
            mentioned_users: [],
            is_silent: false,
            reply_to_message_id: replyToMessageId
        )

        try await client
            .from("chat_messages")
            .insert(body)
            .execute()
    }

    /// העלאה ל־`chat-media` — כל סוג קובץ (וידאו, מסמך, אודיו).
    public func uploadChatFile(groupId: String, data: Data, fileExtension: String, contentType: String) async throws -> String {
        let ext = fileExtension.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let safeExt = ext.isEmpty ? "bin" : ext.replacingOccurrences(of: "/", with: "")
        let name = "\(Int(Date().timeIntervalSince1970 * 1000))-\(UUID().uuidString.prefix(8)).\(safeExt)"
        let path = "\(groupId)/\(name)"
        let opts = FileOptions(contentType: contentType, upsert: false)
        _ = try await client.storage.from(Self.chatMediaBucket).upload(path, data: data, options: opts)
        return path
    }

    /// שליחת הודעת מדיה (וידאו / אודיו / מסמך / וכו’) — תואם ל־`sendChatMessage` ב־RN.
    public func sendMediaMessage(
        groupId: String,
        senderId: String,
        messageType: String,
        mediaPath: String,
        mediaType: String,
        mediaFileName: String?,
        mediaDuration: Int?,
        mediaSize: Int?,
        replyToMessageId: String? = nil
    ) async throws {
        struct InsertBody: Encodable {
            let group_id: String
            let sender_id: String
            let content: String?
            let message_type: String
            let media_url: String
            let media_type: String
            let media_file_name: String?
            let media_duration: Int?
            let media_size: Int?
            let mentioned_users: [String]
            let is_silent: Bool
            let reply_to_message_id: String?
        }

        let body = InsertBody(
            group_id: groupId,
            sender_id: senderId,
            content: nil,
            message_type: messageType,
            media_url: mediaPath,
            media_type: mediaType,
            media_file_name: mediaFileName,
            media_duration: mediaDuration,
            media_size: mediaSize,
            mentioned_users: [],
            is_silent: false,
            reply_to_message_id: replyToMessageId
        )

        try await client
            .from("chat_messages")
            .insert(body)
            .execute()
    }

    /// חיפוש טקסט בקבוצה (פשוט — `ilike` על content).
    public func searchMessagesInGroup(groupId: String, currentUserId: String, query: String, limit: Int = 30) async throws -> [ChatMessageListItem] {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else { return [] }
        let pattern = "%\(q.replacingOccurrences(of: "%", with: "\\%").replacingOccurrences(of: "_", with: "\\_"))%"
        let rows: [ChatMessageDTO] = try await client
            .from("chat_messages")
            .select(Self.messageSelect)
            .eq("group_id", value: groupId)
            .eq("is_deleted", value: false)
            .ilike("content", pattern: pattern)
            .order("created_at", ascending: false)
            .limit(limit)
            .execute()
            .value

        return try await enrichMessageRows(rows, groupId: groupId, currentUserId: currentUserId)
    }

    // MARK: - כוכב / העברה / הגדרות חברות

    public func starMessage(messageId: String, groupId: String, userId: String) async throws {
        struct StarIns: Encodable {
            let message_id: String
            let user_id: String
            let group_id: String
        }
        do {
            try await client
                .from("chat_starred_messages")
                .insert(StarIns(message_id: messageId, user_id: userId, group_id: groupId))
                .execute()
        } catch {
            let desc = String(describing: error)
            if desc.contains("23505") { return }
            throw ChatRepositoryError.supabase(desc)
        }
    }

    public func unstarMessage(messageId: String, userId: String) async throws {
        try await client
            .from("chat_starred_messages")
            .delete()
            .eq("message_id", value: messageId)
            .eq("user_id", value: userId)
            .execute()
    }

    /// העברה לקבוצות אחרות — תואם ל־`forwardChatMessage` ב־RN.
    public func forwardMessage(userId: String, messageId: String, toGroupIds: [String]) async throws {
        let ids = Array(Set(toGroupIds)).filter { !$0.isEmpty }
        guard !ids.isEmpty else { return }

        let rows: [ForwardSourceRow] = try await client
            .from("chat_messages")
            .select("*")
            .eq("id", value: messageId)
            .limit(1)
            .execute()
            .value

        guard let orig = rows.first else {
            throw ChatRepositoryError.supabase("MESSAGE_NOT_FOUND")
        }

        struct MemberIdRow: Decodable, Sendable {
            let id: String?
        }

        struct FwdIns: Encodable {
            let group_id: String
            let sender_id: String
            let content: String?
            let message_type: String
            let media_url: String?
            let media_thumbnail_url: String?
            let media_type: String?
            let media_size: Int?
            let media_duration: Int?
            let media_width: Int?
            let media_height: Int?
            let media_file_name: String?
            let is_forwarded: Bool
            let forwarded_from_group_id: String
            let forwarded_from_message_id: String
        }

        var anySuccess = false
        var lastError: String?

        for gid in ids {
            let mem: [MemberIdRow] = try await client
                .from("chat_group_members")
                .select("id")
                .eq("group_id", value: gid)
                .eq("user_id", value: userId)
                .limit(1)
                .execute()
                .value

            if mem.isEmpty {
                lastError = "NOT_MEMBER"
                continue
            }

            let ins = FwdIns(
                group_id: gid,
                sender_id: userId,
                content: orig.content,
                message_type: orig.message_type,
                media_url: orig.media_url,
                media_thumbnail_url: orig.media_thumbnail_url,
                media_type: orig.media_type,
                media_size: orig.media_size,
                media_duration: orig.media_duration,
                media_width: orig.media_width,
                media_height: orig.media_height,
                media_file_name: orig.media_file_name,
                is_forwarded: true,
                forwarded_from_group_id: orig.group_id,
                forwarded_from_message_id: orig.id
            )

            do {
                try await client.from("chat_messages").insert(ins).execute()
                anySuccess = true
            } catch {
                lastError = String(describing: error)
            }
        }

        if !anySuccess {
            throw ChatRepositoryError.supabase(lastError ?? "FORWARD_FAILED")
        }
    }

    public func setMemberMuted(groupId: String, userId: String, muted: Bool) async throws {
        struct Patch: Encodable { let muted: Bool }
        try await client
            .from("chat_group_members")
            .update(Patch(muted: muted))
            .eq("group_id", value: groupId)
            .eq("user_id", value: userId)
            .execute()
    }

    public func removeSelfFromGroup(groupId: String, userId: String) async throws {
        try await client
            .from("chat_group_members")
            .delete()
            .eq("group_id", value: groupId)
            .eq("user_id", value: userId)
            .execute()
    }

    private struct ForwardSourceRow: Decodable, Sendable {
        let id: String
        let group_id: String
        let content: String?
        let message_type: String
        let media_url: String?
        let media_thumbnail_url: String?
        let media_type: String?
        let media_size: Int?
        let media_duration: Int?
        let media_width: Int?
        let media_height: Int?
        let media_file_name: String?
    }

    // MARK: - פירוט קבוצה (חברים, עריכה, תפקידים — כמו `chatGroupService` ב־RN)

    private static let memberSelect = """
    user_id,
    role,
    user:users (
      id,
      display_name,
      profile_picture,
      is_online
    )
    """

    public func fetchGroupMembers(groupId: String) async throws -> [ChatGroupMemberItem] {
        struct Row: Decodable, Sendable {
            let user_id: String
            let role: String
            let user: ChatSenderDTO?
        }
        let rows: [Row] = try await client
            .from("chat_group_members")
            .select(Self.memberSelect)
            .eq("group_id", value: groupId)
            .execute()
            .value

        return rows.map { row in
            let name = row.user?.display_name?.trimmingCharacters(in: .whitespacesAndNewlines)
            let display = (name?.isEmpty == false) ? name! : "משתמש"
            return ChatGroupMemberItem(userId: row.user_id, displayName: display, role: row.role)
        }
    }

    private func assertUserIsGroupAdmin(groupId: String, userId: String) async throws {
        struct RoleRow: Decodable, Sendable { let role: String }
        let rows: [RoleRow] = try await client
            .from("chat_group_members")
            .select("role")
            .eq("group_id", value: groupId)
            .eq("user_id", value: userId)
            .limit(1)
            .execute()
            .value
        guard rows.first?.role == "admin" else {
            throw ChatRepositoryError.supabase("PERMISSION_DENIED")
        }
    }

    public func updateChatGroupName(groupId: String, editorUserId: String, name: String) async throws {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw ChatRepositoryError.supabase("EMPTY_NAME") }
        try await assertUserIsGroupAdmin(groupId: groupId, userId: editorUserId)
        struct Patch: Encodable {
            let name: String
            let updated_at: String
        }
        let patch = Patch(name: String(trimmed.prefix(120)), updated_at: ISO8601DateFormatter().string(from: Date()))
        try await client
            .from("chat_groups")
            .update(patch)
            .eq("id", value: groupId)
            .execute()
    }

    public func updateChatGroupDescription(groupId: String, editorUserId: String, description: String) async throws {
        try await assertUserIsGroupAdmin(groupId: groupId, userId: editorUserId)
        let stripped = description.replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
        let trimmed = String(stripped.prefix(500))
        struct Patch: Encodable {
            let description: String
            let updated_at: String
        }
        let patch = Patch(description: trimmed, updated_at: ISO8601DateFormatter().string(from: Date()))
        try await client
            .from("chat_groups")
            .update(patch)
            .eq("id", value: groupId)
            .execute()
    }

    public func updateGroupMemberRole(groupId: String, memberUserId: String, newRole: String, actingUserId: String) async throws {
        try await assertUserIsGroupAdmin(groupId: groupId, userId: actingUserId)
        struct Patch: Encodable { let role: String }
        try await client
            .from("chat_group_members")
            .update(Patch(role: newRole))
            .eq("group_id", value: groupId)
            .eq("user_id", value: memberUserId)
            .execute()
    }

    /// אדמין מסיר חבר אחר; לעצמך השתמש ב־`removeSelfFromGroup`.
    public func removeGroupMemberByAdmin(groupId: String, memberUserId: String, actingUserId: String) async throws {
        guard memberUserId != actingUserId else {
            throw ChatRepositoryError.supabase("USE_LEAVE_FOR_SELF")
        }
        try await assertUserIsGroupAdmin(groupId: groupId, userId: actingUserId)
        try await client
            .from("chat_group_members")
            .delete()
            .eq("group_id", value: groupId)
            .eq("user_id", value: memberUserId)
            .execute()
    }
}

private extension [String] {
    func uniqued() -> [String] {
        var s = Set<String>()
        return filter { s.insert($0).inserted }
    }
}
