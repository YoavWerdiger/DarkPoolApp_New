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
/// חבר בקבוצה (למסך פירוט — תואם ל־`getGroupMembers` ב־RN).
public struct ChatGroupMemberItem: Identifiable, Hashable, Sendable {
    public let userId: String
    public let displayName: String
    public let role: String

    public var id: String { userId }

    public init(userId: String, displayName: String, role: String) {
        self.userId = userId
        self.displayName = displayName
        self.role = role
    }

    public var isAdmin: Bool { role == "admin" }
}

public struct ChatGroupListItem: Identifiable, Hashable, Sendable {
    public let id: String
    public let name: String
    public let description: String?
    public let avatarURL: String?
    /// מ־`chat_groups.members_count` כשזמין.
    public let membersCount: Int?
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
        membersCount: Int?,
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
        self.membersCount = membersCount
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

/// מטא־דאטה להודעות מערכת / סקר — תואם ל־`system_message_data` ב־Postgres.
public struct ChatSystemMessageData: Decodable, Sendable {
    public let poll_id: String?
    public let multiple_choice: Bool?
    public let options: [PollOptionStub]?
}

public struct PollOptionStub: Decodable, Sendable {
    public let id: String
    public let text: String
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
    public let media_file_name: String?
    public let media_duration: Int?
    public let media_size: Int?
    public let is_forwarded: Bool?
    public let forwarded_from_group_id: String?
    public let reply_to_message_id: String?
    public let is_edited: Bool?
    public let is_deleted: Bool?
    public let is_system_message: Bool?
    public let is_silent: Bool?
    public let system_message_data: ChatSystemMessageData?
    public let created_at: String
    public let sender: ChatSenderDTO?
}

// MARK: - ריאקציות (שורות מ־chat_message_reactions)

public struct ChatReactionRow: Decodable, Sendable {
    public let message_id: String
    public let user_id: String
    public let emoji: String
    public let user: ChatSenderDTO?

    enum CodingKeys: String, CodingKey {
        case message_id, user_id, emoji, user
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        message_id = try c.decode(String.self, forKey: .message_id)
        user_id = try c.decode(String.self, forKey: .user_id)
        emoji = try c.decode(String.self, forKey: .emoji)
        if let u = try? c.decode(ChatSenderDTO.self, forKey: .user) {
            user = u
        } else if let arr = try? c.decode([ChatSenderDTO].self, forKey: .user) {
            user = arr.first
        } else {
            user = nil
        }
    }
}

// MARK: - UI — הודעה עשירה

public struct ReplyPreview: Equatable, Sendable {
    public let messageId: String
    public let senderName: String
    public let contentPreview: String?

    public init(messageId: String, senderName: String, contentPreview: String?) {
        self.messageId = messageId
        self.senderName = senderName
        self.contentPreview = contentPreview
    }
}

public struct ReactionGroup: Equatable, Sendable {
    public let emoji: String
    public let count: Int
    public let reactedByMe: Bool

    public init(emoji: String, count: Int, reactedByMe: Bool) {
        self.emoji = emoji
        self.count = count
        self.reactedByMe = reactedByMe
    }
}

public struct ChatMessageListItem: Identifiable, Equatable, Sendable {
    public let id: String
    public let groupId: String
    public let senderId: String
    public let senderDisplayName: String
    public let content: String?
    public let messageType: String
    public let mediaURL: String?
    public let mediaFileName: String?
    public let mediaDurationSeconds: Int?
    /// מזהה סקר כש־`message_type == "poll"` (מ־`system_message_data.poll_id`).
    public let pollId: String?
    public let isForwarded: Bool
    public let forwardedFromGroupId: String?
    public let createdAt: Date
    public let isFromCurrentUser: Bool
    public let isEdited: Bool
    public let replyTo: ReplyPreview?
    public var reactions: [ReactionGroup]
    public let isReadByMe: Bool
    public let isStarred: Bool

    public init(
        id: String,
        groupId: String,
        senderId: String,
        senderDisplayName: String,
        content: String?,
        messageType: String,
        mediaURL: String?,
        mediaFileName: String? = nil,
        mediaDurationSeconds: Int? = nil,
        pollId: String?,
        isForwarded: Bool = false,
        forwardedFromGroupId: String? = nil,
        createdAt: Date,
        isFromCurrentUser: Bool,
        isEdited: Bool,
        replyTo: ReplyPreview?,
        reactions: [ReactionGroup],
        isReadByMe: Bool,
        isStarred: Bool
    ) {
        self.id = id
        self.groupId = groupId
        self.senderId = senderId
        self.senderDisplayName = senderDisplayName
        self.content = content
        self.messageType = messageType
        self.mediaURL = mediaURL
        self.mediaFileName = mediaFileName
        self.mediaDurationSeconds = mediaDurationSeconds
        self.pollId = pollId
        self.isForwarded = isForwarded
        self.forwardedFromGroupId = forwardedFromGroupId
        self.createdAt = createdAt
        self.isFromCurrentUser = isFromCurrentUser
        self.isEdited = isEdited
        self.replyTo = replyTo
        self.reactions = reactions
        self.isReadByMe = isReadByMe
        self.isStarred = isStarred
    }

    /// מעתיק עם ריאקציות מעודכנות (Realtime).
    public func withReactions(_ r: [ReactionGroup]) -> ChatMessageListItem {
        ChatMessageListItem(
            id: id,
            groupId: groupId,
            senderId: senderId,
            senderDisplayName: senderDisplayName,
            content: content,
            messageType: messageType,
            mediaURL: mediaURL,
            mediaFileName: mediaFileName,
            mediaDurationSeconds: mediaDurationSeconds,
            pollId: pollId,
            isForwarded: isForwarded,
            forwardedFromGroupId: forwardedFromGroupId,
            createdAt: createdAt,
            isFromCurrentUser: isFromCurrentUser,
            isEdited: isEdited,
            replyTo: replyTo,
            reactions: r,
            isReadByMe: isReadByMe,
            isStarred: isStarred
        )
    }

    public func withStarred(_ starred: Bool) -> ChatMessageListItem {
        ChatMessageListItem(
            id: id,
            groupId: groupId,
            senderId: senderId,
            senderDisplayName: senderDisplayName,
            content: content,
            messageType: messageType,
            mediaURL: mediaURL,
            mediaFileName: mediaFileName,
            mediaDurationSeconds: mediaDurationSeconds,
            pollId: pollId,
            isForwarded: isForwarded,
            forwardedFromGroupId: forwardedFromGroupId,
            createdAt: createdAt,
            isFromCurrentUser: isFromCurrentUser,
            isEdited: isEdited,
            replyTo: replyTo,
            reactions: reactions,
            isReadByMe: isReadByMe,
            isStarred: starred
        )
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
                membersCount: g.members_count,
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

    static func reactionGroups(from rows: [ChatReactionRow], currentUserId: String) -> [String: [ReactionGroup]] {
        var byMessage: [String: [ChatReactionRow]] = [:]
        for r in rows {
            byMessage[r.message_id, default: []].append(r)
        }
        var result: [String: [ReactionGroup]] = [:]
        for (mid, list) in byMessage {
            var emojiMap: [String: (count: Int, me: Bool)] = [:]
            for r in list {
                var e = emojiMap[r.emoji] ?? (0, false)
                e.count += 1
                if r.user_id == currentUserId { e.me = true }
                emojiMap[r.emoji] = e
            }
            result[mid] = emojiMap.map { emoji, v in
                ReactionGroup(emoji: emoji, count: v.count, reactedByMe: v.me)
            }.sorted { $0.emoji < $1.emoji }
        }
        return result
    }

    static func enrichMessages(
        _ rows: [ChatMessageDTO],
        currentUserId: String,
        reactionsByMessage: [String: [ReactionGroup]],
        readIds: Set<String>,
        starredIds: Set<String>,
        replyMap: [String: ReplyPreview],
        deletedIds: Set<String>
    ) -> [ChatMessageListItem] {
        rows
            .filter { !deletedIds.contains($0.id) }
            .map { m in
                let reply: ReplyPreview? = {
                    guard let rid = m.reply_to_message_id else { return nil }
                    return replyMap[rid]
                }()
                let pollId = m.system_message_data?.poll_id
                return ChatMessageListItem(
                    id: m.id,
                    groupId: m.group_id,
                    senderId: m.sender_id,
                    senderDisplayName: m.sender?.display_name ?? "משתמש",
                    content: m.content,
                    messageType: m.message_type,
                    mediaURL: m.media_url,
                    mediaFileName: m.media_file_name,
                    mediaDurationSeconds: m.media_duration,
                    pollId: pollId,
                    isForwarded: m.is_forwarded ?? false,
                    forwardedFromGroupId: m.forwarded_from_group_id,
                    createdAt: parseISODate(m.created_at) ?? Date(),
                    isFromCurrentUser: m.sender_id == currentUserId,
                    isEdited: m.is_edited ?? false,
                    replyTo: reply,
                    reactions: reactionsByMessage[m.id] ?? [],
                    isReadByMe: readIds.contains(m.id),
                    isStarred: starredIds.contains(m.id)
                )
            }
    }

    static func mapSingle(_ m: ChatMessageDTO, currentUserId: String) -> ChatMessageListItem {
        ChatMessageListItem(
            id: m.id,
            groupId: m.group_id,
            senderId: m.sender_id,
            senderDisplayName: m.sender?.display_name ?? "משתמש",
            content: m.content,
            messageType: m.message_type,
            mediaURL: m.media_url,
            mediaFileName: m.media_file_name,
            mediaDurationSeconds: m.media_duration,
            pollId: m.system_message_data?.poll_id,
            isForwarded: m.is_forwarded ?? false,
            forwardedFromGroupId: m.forwarded_from_group_id,
            createdAt: parseISODate(m.created_at) ?? Date(),
            isFromCurrentUser: m.sender_id == currentUserId,
            isEdited: m.is_edited ?? false,
            replyTo: nil,
            reactions: [],
            isReadByMe: false,
            isStarred: false
        )
    }
}
