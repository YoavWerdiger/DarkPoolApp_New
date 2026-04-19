import Foundation
import Supabase

public struct PollOptionDTO: Codable, Sendable, Identifiable {
    public let id: String
    public let text: String
    public var votes_count: Int?

    public init(id: String, text: String, votes_count: Int?) {
        self.id = id
        self.text = text
        self.votes_count = votes_count
    }
}

public struct PollWithVotes: Sendable {
    public let id: String
    public let chat_id: String
    public let creator_id: String
    public let question: String
    public let options: [PollOptionDTO]
    public let multiple_choice: Bool
    public let is_locked: Bool
    public let user_votes: [String]?
    public let total_votes: Int

    public init(
        id: String,
        chat_id: String,
        creator_id: String,
        question: String,
        options: [PollOptionDTO],
        multiple_choice: Bool,
        is_locked: Bool,
        user_votes: [String]?,
        total_votes: Int
    ) {
        self.id = id
        self.chat_id = chat_id
        self.creator_id = creator_id
        self.question = question
        self.options = options
        self.multiple_choice = multiple_choice
        self.is_locked = is_locked
        self.user_votes = user_votes
        self.total_votes = total_votes
    }
}

public final class PollRepository: @unchecked Sendable {
    private let client: SupabaseClient

    public init(client: SupabaseClient) {
        self.client = client
    }

    public func getPollResults(pollId: String, userId: String?) async throws -> PollWithVotes {
        let rows: [PollRowRaw] = try await client
            .from("polls")
            .select()
            .eq("id", value: pollId)
            .limit(1)
            .execute()
            .value

        guard let raw = rows.first else {
            throw ChatRepositoryError.supabase("Poll not found")
        }

        var userVotes: [String] = []
        if let userId {
            struct VoteRow: Decodable {
                let option_id: String
            }
            let votes: [VoteRow] = try await client
                .from("poll_votes")
                .select("option_id")
                .eq("poll_id", value: pollId)
                .eq("user_id", value: userId)
                .execute()
                .value
            userVotes = votes.map(\.option_id)
        }

        let total = raw.options.reduce(0) { $0 + ($1.votes_count ?? 0) }
        return PollWithVotes(
            id: raw.id,
            chat_id: raw.chat_id,
            creator_id: raw.creator_id,
            question: raw.question,
            options: raw.options,
            multiple_choice: raw.multiple_choice,
            is_locked: raw.is_locked,
            user_votes: userVotes,
            total_votes: total
        )
    }

    public func votePoll(pollId: String, optionIds: [String], userId: String) async throws {
        struct LockRow: Decodable {
            let is_locked: Bool
            let multiple_choice: Bool
        }
        let lockRows: [LockRow] = try await client
            .from("polls")
            .select("is_locked, multiple_choice")
            .eq("id", value: pollId)
            .limit(1)
            .execute()
            .value

        guard let lock = lockRows.first else {
            throw ChatRepositoryError.supabase("Poll not found")
        }
        if lock.is_locked {
            throw ChatRepositoryError.supabase("הסקר נעול")
        }
        if !lock.multiple_choice && optionIds.count > 1 {
            throw ChatRepositoryError.supabase("סקר זה מאפשר רק תשובה אחת")
        }

        let fullRows: [PollRowRaw] = try await client
            .from("polls")
            .select()
            .eq("id", value: pollId)
            .limit(1)
            .execute()
            .value

        guard let full = fullRows.first else {
            throw ChatRepositoryError.supabase("Poll not found")
        }
        let validIds = Set(full.options.map(\.id))
        let invalid = optionIds.filter { !validIds.contains($0) }
        if !invalid.isEmpty {
            throw ChatRepositoryError.supabase("אפשרויות הצבעה לא תקינות")
        }

        try await client
            .from("poll_votes")
            .delete()
            .eq("poll_id", value: pollId)
            .eq("user_id", value: userId)
            .execute()

        struct Ins: Encodable {
            let poll_id: String
            let user_id: String
            let option_id: String
        }
        let rows = optionIds.map { Ins(poll_id: pollId, user_id: userId, option_id: $0) }
        if !rows.isEmpty {
            try await client.from("poll_votes").insert(rows).execute()
        }

        try await updatePollVoteCounts(pollId: pollId)
    }

    private struct PollRowRaw: Decodable {
        let id: String
        let chat_id: String
        let creator_id: String
        let question: String
        let options: [PollOptionDTO]
        let multiple_choice: Bool
        let is_locked: Bool
    }

    private func updatePollVoteCounts(pollId: String) async throws {
        struct VoteCountRow: Decodable {
            let option_id: String
        }
        let votes: [VoteCountRow] = try await client
            .from("poll_votes")
            .select("option_id")
            .eq("poll_id", value: pollId)
            .execute()
            .value

        var counts: [String: Int] = [:]
        for v in votes {
            counts[v.option_id, default: 0] += 1
        }

        let pollRows: [PollRowRaw] = try await client
            .from("polls")
            .select()
            .eq("id", value: pollId)
            .limit(1)
            .execute()
            .value

        guard let poll = pollRows.first else { return }

        let updated = poll.options.map { o -> PollOptionDTO in
            let c = counts[o.id] ?? 0
            return PollOptionDTO(id: o.id, text: o.text, votes_count: c)
        }

        struct Patch: Encodable {
            let options: [PollOptionDTO]
        }
        try await client
            .from("polls")
            .update(Patch(options: updated))
            .eq("id", value: pollId)
            .execute()
    }
}
