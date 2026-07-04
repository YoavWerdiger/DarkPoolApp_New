import Foundation
import Storage
import Supabase

public struct StoryStripItem: Identifiable, Hashable, Sendable {
    public var id: String { userId }
    public let userId: String
    public let displayName: String
    public let profilePicture: String?
    public let storyCount: Int
    public let hasUnviewed: Bool
    public let previewMediaPath: String?
    public let previewMediaType: String?

    public init(
        userId: String,
        displayName: String,
        profilePicture: String?,
        storyCount: Int,
        hasUnviewed: Bool,
        previewMediaPath: String?,
        previewMediaType: String?
    ) {
        self.userId = userId
        self.displayName = displayName
        self.profilePicture = profilePicture
        self.storyCount = storyCount
        self.hasUnviewed = hasUnviewed
        self.previewMediaPath = previewMediaPath
        self.previewMediaType = previewMediaType
    }
}

public struct UserStoryRow: Identifiable, Decodable, Sendable {
    public let id: String
    public let user_id: String
    public let media_type: String
    public let media_url: String?
    public let content: String?
    public let background_color: String?
    public let created_at: String
    public let expires_at: String
}

private let storiesBucket = "chat-media"
private let storyHours: TimeInterval = 24 * 3600

public final class StoriesRepository: @unchecked Sendable {
    private let client: SupabaseClient

    public init(client: SupabaseClient) {
        self.client = client
    }

    /// תואם ל־`getUsersWithStories` — סיכום לפי משתמש לשורת סטוריז.
    public func fetchStoryStrip(currentUserId: String?) async throws -> [StoryStripItem] {
        struct StoryLite: Decodable {
            let id: String
            let user_id: String
            let media_type: String
            let media_url: String?
            let created_at: String
        }

        let now = ISO8601DateFormatter().string(from: Date())
        let stories: [StoryLite] = try await client
            .from("user_stories")
            .select("id, user_id, media_type, media_url, created_at")
            .gt("expires_at", value: now)
            .order("created_at", ascending: false)
            .execute()
            .value

        if stories.isEmpty { return [] }

        let userIds = Array(Set(stories.map(\.user_id)))
        struct UserLite: Decodable {
            let id: String
            let display_name: String?
            let full_name: String?
            let profile_picture: String?
        }
        let users: [UserLite] = try await client
            .from("users")
            .select("id, display_name, full_name, profile_picture")
            .in("id", values: userIds)
            .execute()
            .value

        let userMap = Dictionary(uniqueKeysWithValues: users.map { ($0.id, $0) })

        var viewedIds = Set<String>()
        if let currentUserId {
            struct ViewRow: Decodable {
                let story_id: String
            }
            let storyIds = stories.map(\.id)
            let views: [ViewRow] = try await client
                .from("user_story_views")
                .select("story_id")
                .eq("viewer_id", value: currentUserId)
                .in("story_id", values: storyIds)
                .execute()
                .value
            viewedIds = Set(views.map(\.story_id))
        }

        var byUser: [String: (story: StoryLite, count: Int, allViewed: Bool)] = [:]
        for s in stories {
            if var ex = byUser[s.user_id] {
                ex.count += 1
                if !viewedIds.contains(s.id) { ex.allViewed = false }
                byUser[s.user_id] = ex
            } else {
                byUser[s.user_id] = (s, 1, viewedIds.contains(s.id))
            }
        }

        var items: [StoryStripItem] = []
        for (uid, v) in byUser {
            let u = userMap[uid]
            let name = u?.display_name ?? u?.full_name ?? "משתמש"
            items.append(
                StoryStripItem(
                    userId: uid,
                    displayName: name,
                    profilePicture: u?.profile_picture,
                    storyCount: v.count,
                    hasUnviewed: !v.allViewed,
                    previewMediaPath: v.story.media_url,
                    previewMediaType: v.story.media_type
                )
            )
        }

        if let me = currentUserId {
            items.sort { a, b in
                if a.userId == me { return true }
                if b.userId == me { return false }
                if a.hasUnviewed == b.hasUnviewed { return false }
                return a.hasUnviewed && !b.hasUnviewed
            }
        }

        return items
    }

    public func fetchStoriesForUser(userId: String) async throws -> [UserStoryRow] {
        let now = ISO8601DateFormatter().string(from: Date())
        let rows: [UserStoryRow] = try await client
            .from("user_stories")
            .select()
            .eq("user_id", value: userId)
            .gt("expires_at", value: now)
            .order("created_at", ascending: true)
            .execute()
            .value
        return rows
    }

    public func markStoryViewed(storyId: String, viewerId: String) async throws {
        struct Ins: Encodable {
            let story_id: String
            let viewer_id: String
        }
        try await client
            .from("user_story_views")
            .upsert(Ins(story_id: storyId, viewer_id: viewerId), onConflict: "story_id,viewer_id", ignoreDuplicates: true)
            .execute()
    }

    public func signedURLForStoryMedia(pathOrRef: String) async throws -> URL {
        let path = ChatMediaURL.storagePath(from: pathOrRef) ?? pathOrRef
        return try await client.storage.from(storiesBucket).createSignedURL(path: path, expiresIn: 3600)
    }

    public func uploadStoryImage(data: Data, userId: String) async throws -> String {
        let name = "\(Int(Date().timeIntervalSince1970 * 1000))-\(UUID().uuidString.prefix(8)).jpg"
        let path = "stories/\(userId)/\(name)"
        let opts = FileOptions(contentType: "image/jpeg", upsert: false)
        _ = try await client.storage.from(storiesBucket).upload(path, data: data, options: opts)
        return path
    }

    public func createStory(userId: String, mediaPath: String) async throws -> UserStoryRow {
        let exp = Date().addingTimeInterval(storyHours)
        struct Ins: Encodable {
            let user_id: String
            let media_type: String
            let media_url: String
            let expires_at: String
        }
        let ins = Ins(
            user_id: userId,
            media_type: "image",
            media_url: mediaPath,
            expires_at: ISO8601DateFormatter().string(from: exp)
        )
        let rows: [UserStoryRow] = try await client
            .from("user_stories")
            .insert(ins)
            .select()
            .execute()
            .value
        guard let row = rows.first else {
            throw ChatRepositoryError.supabase("Story insert failed")
        }
        return row
    }
}
