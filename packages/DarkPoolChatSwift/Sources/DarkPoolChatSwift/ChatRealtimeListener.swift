import Foundation
import Supabase

/// מאזין ל־INSERT ב־`chat_messages` לפי `group_id` — משלים שליפה עם join לשולח (כמו ב־RN).
public final class ChatRealtimeListener: @unchecked Sendable {
    private let client: SupabaseClient
    private var task: Task<Void, Never>?
    private var channel: RealtimeChannelV2?

    public init(configuration: DarkPoolChatConfiguration) {
        self.client = configuration.makeClient()
    }

    public init(client: SupabaseClient) {
        self.client = client
    }

    deinit {
        task?.cancel()
    }

    /// `onMessage` נקרא ב־MainActor (מתאים לעדכון SwiftUI).
    public func subscribeToGroupMessages(
        groupId: String,
        currentUserId: String,
        onMessage: @escaping @MainActor (ChatMessageListItem) -> Void
    ) async {
        await unsubscribe()

        let ch = client.realtimeV2.channel("chat-swift:\(groupId)")

        let stream = await ch.postgresChange(
            InsertAction.self,
            schema: "public",
            table: "chat_messages",
            filter: .eq("group_id", value: groupId)
        )

        do {
            try await ch.subscribeWithError()
        } catch {
            return
        }

        self.channel = ch

        let supabaseClient = self.client
        self.task = Task {
            for await insert in stream {
                let record = insert.record
                guard let messageId = record["id"]?.stringValue else { continue }

                if record["sender_id"]?.stringValue == currentUserId {
                    continue
                }

                do {
                    let repo = ChatRepository(client: supabaseClient)
                    let dto = try await repo.fetchMessageById(messageId)
                    let item = ChatDTOMapper.mapMessages([dto], currentUserId: currentUserId).first
                    if let item {
                        await onMessage(item)
                    }
                } catch {
                    continue
                }
            }
        }
    }

    public func unsubscribe() async {
        task?.cancel()
        task = nil
        if let ch = channel {
            await ch.unsubscribe()
            channel = nil
        }
    }
}
