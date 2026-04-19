import SwiftUI

/// תצוגת סקר — טקסט ופקדים בסגנון מערכת + accent מותג.
public struct PollMessageView: View {
    let pollId: String
    @ObservedObject var model: ChatSessionViewModel

    @State private var poll: PollWithVotes?
    @State private var selected: Set<String> = []
    @State private var loading = true
    @State private var voting = false

    public init(pollId: String, model: ChatSessionViewModel) {
        self.pollId = pollId
        self.model = model
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if loading {
                ProgressView()
                    .frame(maxWidth: .infinity)
            } else if let p = poll {
                Text(p.question)
                    .font(.headline)
                    .foregroundStyle(.primary)
                    .frame(maxWidth: .infinity, alignment: .leading)

                if p.is_locked {
                    Text("הסקר נעול")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                let total = max(p.total_votes, 1)

                ForEach(p.options) { opt in
                    VStack(alignment: .leading, spacing: 4) {
                        optionRow(opt, poll: p)

                        let count = opt.votes_count ?? 0
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Capsule().fill(ChatSwiftTheme.fill)
                                Capsule()
                                    .fill(ChatDesignTokens.brand.opacity(0.35))
                                    .frame(width: geo.size.width * CGFloat(count) / CGFloat(total))
                            }
                        }
                        .frame(height: 6)

                        HStack {
                            Text(opt.text)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                            Spacer()
                            Text("\(count)")
                                .font(.caption2)
                                .foregroundStyle(ChatSwiftTheme.tertiaryLabel)
                        }
                    }
                }

                Text("סה״כ הצבעות: \(p.total_votes)")
                    .font(.caption2)
                    .foregroundStyle(ChatSwiftTheme.tertiaryLabel)

                if !p.is_locked {
                    Button(action: { Task { await submitVote() } }) {
                        if voting {
                            ProgressView()
                        } else {
                            Text("שלח הצבעה")
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(ChatDesignTokens.brand)
                    .disabled(voting || selected.isEmpty)
                }
            } else {
                Text("לא ניתן לטעון סקר")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .task(id: pollId) {
            await reload()
        }
    }

    private func optionRow(_ opt: PollOptionDTO, poll p: PollWithVotes) -> some View {
        let mine = p.user_votes?.contains(opt.id) ?? false
        let isMulti = p.multiple_choice
        return Button {
            if p.is_locked { return }
            if isMulti {
                if selected.contains(opt.id) {
                    selected.remove(opt.id)
                } else {
                    selected.insert(opt.id)
                }
            } else {
                selected = [opt.id]
            }
        } label: {
            HStack {
                Image(systemName: (isMulti ? selected.contains(opt.id) : selected == [opt.id]) || mine ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(ChatDesignTokens.brand)
                Text(opt.text)
                    .foregroundStyle(.primary)
                Spacer()
            }
            .padding(8)
            .background(ChatSwiftTheme.fill)
            .clipShape(RoundedRectangle(cornerRadius: ChatDesignTokens.Radius.sm, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private func reload() async {
        loading = true
        defer { loading = false }
        do {
            let p = try await model.loadPoll(pollId: pollId)
            poll = p
            if let uv = p.user_votes, !uv.isEmpty {
                selected = Set(uv)
            }
        } catch {
            poll = nil
        }
    }

    private func submitVote() async {
        guard let p = poll, !p.is_locked else { return }
        let ids = Array(selected)
        guard !ids.isEmpty else { return }
        voting = true
        defer { voting = false }
        do {
            try await model.voteOnPoll(pollId: pollId, optionIds: ids)
            let fresh = try await model.loadPoll(pollId: pollId)
            poll = fresh
            if let uv = fresh.user_votes {
                selected = Set(uv)
            }
        } catch {
            model.errorMessage = error.localizedDescription
        }
    }
}
