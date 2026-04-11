import Foundation
import Supabase

public enum ChatRepositoryError: Error, Sendable {
    case supabase(String)
    case decoding
}

/// שכבת גישה ל־PostgREST — תואמת ל־`chatGroupService.getChatGroups` / `chatMessageService.getChatMessages` (גרסה ראשונה ללא ריאקציות/כוכבים).
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

    public func fetchMessages(
        groupId: String,
        currentUserId: String,
        limit: Int = 50,
        offset: Int = 0
    ) async throws -> [ChatMessageListItem] {
        let rows: [ChatMessageDTO] = try await client
            .from("chat_messages")
            .select(Self.messageSelect)
            .eq("group_id", value: groupId)
            .eq("is_deleted", value: false)
            .order("created_at", ascending: false)
            .range(from: offset, to: offset + max(0, limit - 1))
            .execute()
            .value

        return ChatDTOMapper.mapMessages(rows, currentUserId: currentUserId)
    }

    /// שליפת הודעה אחת אחרי Realtime INSERT (כמו ב־`ChatService` ב־RN).
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

    public func sendTextMessage(
        groupId: String,
        senderId: String,
        text: String
    ) async throws {
        struct InsertBody: Encodable {
            let group_id: String
            let sender_id: String
            let content: String
            let message_type: String
            let mentioned_users: [String]
            let is_silent: Bool
        }

        let body = InsertBody(
            group_id: groupId,
            sender_id: senderId,
            content: text,
            message_type: "text",
            mentioned_users: [],
            is_silent: false
        )

        try await client
            .from("chat_messages")
            .insert(body)
            .execute()
    }
}
