import Foundation

// MARK: - Groups (שורות מ־chat_group_members + join ל־chat_groups)

public struct ChatGroupMemberRow: Decodable, Sendable {
    public let group_id: String
    public let role: String
    public let muted: Bool?
    public let unread_count: Int?
    public let mentioned_count: Int?
    public let last_read_message_id: String?
    public let chat_groups: ChatGroupRow
}

public struct ChatGroupRow: Decodable, Sendable, Identifiable {
    public let id: String
    public let name: String
    public let description: String?
    public let avatar_url: String?
    public let created_by: String
    public let created_at: String
    public let updated_at: String
    public let members_count: Int?
    public let messages_count: Int?
    public let last_message_at: String?
    public let last_message_preview: String?
    public let settings: ChatGroupSettingsJSON?
}

/// JSONB — תואם למפתחות מהאפליקציה (camelCase).
public struct ChatGroupSettingsJSON: Decodable, Sendable {
    public let muteNotifications: Bool?
    public let onlyAdminsCanSend: Bool?
    public let onlyAdminsCanEditInfo: Bool?
    public let showJoinMessages: Bool?
    public let allowMembersToAddOthers: Bool?
}

/// מודל דומיין לרשימת צ׳אטים (אחרי מיפוי).
public struct ChatGroupListItem: Identifiable, Hashable, Sendable {
    public let id: String
    public let name: String
    public let description: String?
    public let avatarURL: String?
    public let lastMessageAt: Date?
    public let lastMessagePreview: String?
    public let unreadCount: Int
    public let mentionedCount: Int
    public let isMuted: Bool
    public let myRole: String
    public let lastReadMessageId: String?

    public init(
        id: String,
        name: String,
        description: String?,
        avatarURL: String?,
        lastMessageAt: Date?,
        lastMessagePreview: String?,
        unreadCount: Int,
        mentionedCount: Int,
        isMuted: Bool,
        myRole: String,
        lastReadMessageId: String?
    ) {
        self.id = id
        self.name = name
        self.description = description
        self.avatarURL = avatarURL
        self.lastMessageAt = lastMessageAt
        self.lastMessagePreview = lastMessagePreview
        self.unreadCount = unreadCount
        self.mentionedCount = mentionedCount
        self.isMuted = isMuted
        self.myRole = myRole
        self.lastReadMessageId = lastReadMessageId
    }
}

// MARK: - Messages

public struct ChatSenderDTO: Decodable, Sendable {
    public let id: String
    public let display_name: String?
    public let profile_picture: String?
    public let is_online: Bool?
}

public struct ChatMessageDTO: Decodable, Sendable, Identifiable {
    public let id: String
    public let group_id: String
    public let sender_id: String
    public let content: String?
    public let message_type: String
    public let media_url: String?
    public let media_thumbnail_url: String?
    public let media_type: String?
    public let reply_to_message_id: String?
    public let is_edited: Bool?
    public let is_deleted: Bool?
    public let is_system_message: Bool?
    public let is_silent: Bool?
    public let created_at: String
    public let sender: ChatSenderDTO?
}

public struct ChatMessageListItem: Identifiable, Hashable, Sendable {
    public let id: String
    public let groupId: String
    public let senderId: String
    public let senderDisplayName: String
    public let content: String?
    public let messageType: String
    public let createdAt: Date
    public let isFromCurrentUser: Bool

    public init(
        id: String,
        groupId: String,
        senderId: String,
        senderDisplayName: String,
        content: String?,
        messageType: String,
        createdAt: Date,
        isFromCurrentUser: Bool
    ) {
        self.id = id
        self.groupId = groupId
        self.senderId = senderId
        self.senderDisplayName = senderDisplayName
        self.content = content
        self.messageType = messageType
        self.createdAt = createdAt
        self.isFromCurrentUser = isFromCurrentUser
    }
}

enum ChatDTOMapper {
    private static let isoWithFractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let isoPlain: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    static func parseISODate(_ s: String) -> Date? {
        isoWithFractional.date(from: s) ?? isoPlain.date(from: s)
    }

    static func mapGroups(_ rows: [ChatGroupMemberRow]) -> [ChatGroupListItem] {
        let items = rows.map { row -> ChatGroupListItem in
            let g = row.chat_groups
            let lastAt = g.last_message_at.flatMap { parseISODate($0) }
            return ChatGroupListItem(
                id: g.id,
                name: g.name,
                description: g.description,
                avatarURL: g.avatar_url,
                lastMessageAt: lastAt,
                lastMessagePreview: g.last_message_preview,
                unreadCount: row.unread_count ?? 0,
                mentionedCount: row.mentioned_count ?? 0,
                isMuted: row.muted ?? false,
                myRole: row.role,
                lastReadMessageId: row.last_read_message_id
            )
        }
        return items.sorted {
            ($0.lastMessageAt ?? .distantPast) > ($1.lastMessageAt ?? .distantPast)
        }
    }

    static func mapMessages(_ rows: [ChatMessageDTO], currentUserId: String) -> [ChatMessageListItem] {
        rows.map { m in
            ChatMessageListItem(
                id: m.id,
                groupId: m.group_id,
                senderId: m.sender_id,
                senderDisplayName: m.sender?.display_name ?? "משתמש",
                content: m.content,
                messageType: m.message_type,
                createdAt: parseISODate(m.created_at) ?? Date(),
                isFromCurrentUser: m.sender_id == currentUserId
            )
        }
    }
}
