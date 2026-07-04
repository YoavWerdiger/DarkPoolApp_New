import SwiftUI

/// שורת סטוריז — סגנון נייטיבי (מעגלים, SF Symbols, צבעי מערכת + accent מותג).
public struct StoryStripView: View {
    let items: [StoryStripItem]
    var onSelect: (StoryStripItem) -> Void
    var onAddTap: () -> Void

    public init(
        items: [StoryStripItem],
        onSelect: @escaping (StoryStripItem) -> Void,
        onAddTap: @escaping () -> Void
    ) {
        self.items = items
        self.onSelect = onSelect
        self.onAddTap = onAddTap
    }

    public var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 14) {
                Button(action: onAddTap) {
                    VStack(spacing: 4) {
                        ZStack {
                            Circle()
                                .strokeBorder(ChatDesignTokens.brand, lineWidth: 2)
                                .frame(width: 56, height: 56)
                            Image(systemName: "plus.circle.fill")
                                .font(.title2)
                                .foregroundStyle(ChatDesignTokens.brand)
                        }
                        Text("הוסף")
                            .font(.caption2)
                            .foregroundStyle(ChatBrandTheme.textSecondary)
                            .lineLimit(1)
                    }
                }
                .buttonStyle(.plain)

                ForEach(items) { item in
                    Button {
                        onSelect(item)
                    } label: {
                        VStack(spacing: 4) {
                            ZStack {
                                Circle()
                                    .strokeBorder(
                                        item.hasUnviewed ? ChatDesignTokens.brand : ChatBrandTheme.borderDefault,
                                        lineWidth: item.hasUnviewed ? 2.5 : 1
                                    )
                                    .frame(width: 56, height: 56)
                                avatarBody(for: item)
                                    .frame(width: 52, height: 52)
                                    .clipShape(Circle())
                            }
                            Text(item.displayName)
                                .font(.caption2)
                                .foregroundStyle(ChatBrandTheme.textSecondary)
                                .lineLimit(1)
                                .frame(width: 64)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 4)
        }
        .frame(height: 88)
    }

    @ViewBuilder
    private func avatarBody(for item: StoryStripItem) -> some View {
        if let pic = item.profilePicture, let u = URL(string: pic), pic.hasPrefix("http") {
            AsyncImage(url: u) { phase in
                switch phase {
                case .success(let img): img.resizable().scaledToFill()
                default: placeholderInitial(item.displayName)
                }
            }
        } else {
            placeholderInitial(item.displayName)
        }
    }

    private func placeholderInitial(_ name: String) -> some View {
        Text(String(name.prefix(1)))
            .font(.title3.weight(.medium))
            .foregroundStyle(ChatBrandTheme.textSecondary)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(ChatBrandTheme.avatarPlaceholderFill)
    }
}
