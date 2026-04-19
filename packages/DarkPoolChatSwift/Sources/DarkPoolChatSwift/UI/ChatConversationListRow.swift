import SwiftUI

/// שורת רשימת צ׳אטים — כרטיס DarkPool: רקע כהה, פינות מעוגלות, אווטאר עגול עם תמונה, טבעת מותג כשיש לא נקרא.
public struct ChatConversationListRow: View {
    let group: ChatGroupListItem

    public init(group: ChatGroupListItem) {
        self.group = group
    }

    private var hasUnread: Bool { group.unreadCount > 0 }
    private var hasMention: Bool { group.mentionedCount > 0 }

    public var body: some View {
        HStack(alignment: .center, spacing: ChatDesignTokens.Spacing.md) {
            avatarView
            VStack(alignment: .leading, spacing: 6) {
                titleRow
                previewRow
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(ChatDesignTokens.Spacing.md)
        .background(cardBackground)
    }

    // MARK: - כרטיס

    private var cardBackground: some View {
        RoundedRectangle(cornerRadius: 20, style: .continuous)
            .fill(rowGlassFill)
            .overlay(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .strokeBorder(
                        strokeForCard,
                        lineWidth: hasUnread || hasMention ? 1.5 : 1
                    )
            )
            // צל כהה בלבד — צל ירוק הדגיש את הרצועות מול הגרדיאנט
            .shadow(color: Color.black.opacity(0.22), radius: 8, x: 0, y: 3)
    }

    private var rowGlassFill: Color {
        if hasUnread || hasMention { return ChatBrandTheme.chatListRowGlassUnread }
        return ChatBrandTheme.chatListRowGlass
    }

    private var strokeForCard: Color {
        if hasMention { return ChatBrandTheme.warning.opacity(0.55) }
        if hasUnread { return ChatBrandTheme.borderAccent }
        return ChatBrandTheme.borderDefault
    }

    // MARK: - אווטאר

    private var avatarView: some View {
        ZStack {
            if let urlString = group.avatarURL, let url = URL(string: urlString) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .empty:
                        Circle()
                            .fill(ChatBrandTheme.avatarPlaceholderFill)
                            .overlay(ProgressView().tint(ChatDesignTokens.brand))
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                    case .failure:
                        placeholderInitials
                    @unknown default:
                        placeholderInitials
                    }
                }
            } else {
                placeholderInitials
            }
        }
        .frame(width: 56, height: 56)
        .clipShape(Circle())
        .overlay(
            Circle()
                .strokeBorder(
                    ringForAvatar,
                    lineWidth: hasUnread || hasMention ? 2.5 : 1
                )
        )
    }

    private var ringForAvatar: Color {
        if hasMention { return ChatBrandTheme.warning }
        if hasUnread { return ChatDesignTokens.brand }
        return ChatBrandTheme.borderDefault
    }

    private var placeholderInitials: some View {
        ZStack {
            Circle()
                .fill(ChatBrandTheme.avatarPlaceholderFill)
            Text(initials(from: group.name))
                .font(.system(size: 18, weight: .semibold, design: .rounded))
                .foregroundStyle(ChatBrandTheme.textSecondary)
        }
    }

    // MARK: - כותרת

    private var titleRow: some View {
        HStack(alignment: .firstTextBaseline, spacing: ChatDesignTokens.Spacing.sm) {
            Text(group.name)
                .font(.system(size: 17, weight: hasUnread || hasMention ? .semibold : .medium, design: .rounded))
                .foregroundStyle(ChatBrandTheme.textPrimary)
                .lineLimit(1)

            if group.isMuted {
                Image(systemName: "bell.slash.fill")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(ChatBrandTheme.textTertiary)
            }

            if hasMention {
                Text("@")
                    .font(.system(size: 11, weight: .bold, design: .rounded))
                    .foregroundStyle(ChatBrandTheme.textOnBrand)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Capsule().fill(ChatBrandTheme.warning.opacity(0.9)))
            }

            Spacer(minLength: 8)

            if let ts = group.lastMessageAt {
                Text(ChatRelativeTimeFormatter.string(for: ts))
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundStyle(hasUnread ? ChatDesignTokens.brand : ChatBrandTheme.textTertiary)
            }
        }
    }

    // MARK: - תצוגה מקדימה

    private var previewRow: some View {
        HStack(alignment: .center, spacing: ChatDesignTokens.Spacing.sm) {
            Text(previewText)
                .font(.system(size: 14, weight: hasUnread ? .medium : .regular, design: .rounded))
                .foregroundStyle(hasUnread ? ChatBrandTheme.textSecondary : ChatBrandTheme.textTertiary)
                .lineLimit(2)
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)

            if group.unreadCount > 0 {
                Text(unreadBadgeText)
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .foregroundStyle(ChatBrandTheme.textOnBrand)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Capsule().fill(ChatDesignTokens.brand))
            }
        }
    }

    private var previewText: String {
        let raw = group.lastMessagePreview?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if raw.isEmpty { return "אין הודעות עדיין" }
        return raw
    }

    private var unreadBadgeText: String {
        group.unreadCount > 99 ? "99+" : "\(group.unreadCount)"
    }

    private func initials(from name: String) -> String {
        let parts = name.split(separator: " ").filter { !$0.isEmpty }
        if parts.count >= 2 {
            let a = parts[0].prefix(1)
            let b = parts[1].prefix(1)
            return "\(a)\(b)".uppercased()
        }
        if let first = parts.first {
            return String(first.prefix(2)).uppercased()
        }
        return "?"
    }
}
