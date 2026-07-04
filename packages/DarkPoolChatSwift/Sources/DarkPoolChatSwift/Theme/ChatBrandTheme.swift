import SwiftUI

/// צבעי מותג DarkPool — תואם ל־`DesignTokens` / `ui-design-system.mdc` (ירוק-שחור, פינות, זכוכית).
public enum ChatBrandTheme {

    // MARK: - רקעים (green-black)

    public static let backgroundPrimary = Color(red: 10 / 255, green: 14 / 255, blue: 10 / 255) // #0A0E0A
    public static let backgroundSecondary = Color(red: 15 / 255, green: 26 / 255, blue: 15 / 255) // #0F1A0F
    public static let backgroundTertiary = Color(red: 20 / 255, green: 32 / 255, blue: 20 / 255) // #142014
    public static let cardSolid = Color(red: 20 / 255, green: 31 / 255, blue: 20 / 255) // #141F14
    public static let elevated = Color(red: 26 / 255, green: 43 / 255, blue: 26 / 255) // #1A2B1A

    /// כמו `background.header` ב־RN — סרגל עליון.
    public static let navBarBackground = Color(red: 15 / 255, green: 26 / 255, blue: 15 / 255).opacity(0.92)

    public static let glassFill = Color.white.opacity(0.05)
    public static let glassBorder = Color.white.opacity(0.08)

    /// שורת רשימת צ׳אטים על גרדיאנט — לא מילוי `#141F14` מלא (נראה בהיר מדי); שכבת זכוכית כהה.
    public static let chatListRowGlass = Color.white.opacity(0.042)
    /// מעט יותר נוכחות כשיש לא נקרא — עדיין כהה.
    public static let chatListRowGlassUnread = Color.white.opacity(0.065)

    // MARK: - טקסט

    public static let textPrimary = Color.white
    public static let textSecondary = Color.white.opacity(0.70)
    public static let textTertiary = Color.white.opacity(0.45)
    public static let textMuted = Color.white.opacity(0.30)
    public static let textOnBrand = Color(red: 10 / 255, green: 14 / 255, blue: 10 / 255) // inverse על ירוק

    // MARK: - גבולות

    public static let borderDefault = Color.white.opacity(0.08)
    public static let borderSubtle = Color.white.opacity(0.04)
    public static let borderDivider = Color.white.opacity(0.06)
    public static let borderAccent = ChatDesignTokens.brand.opacity(0.35)

    // MARK: - הדגשות

    public static let warning = Color(red: 255 / 255, green: 184 / 255, blue: 0 / 255) // #FFB800 — אזכור
    public static let primaryDim = ChatDesignTokens.brand.opacity(0.12)

    // MARK: - מילוי אווטאר ריק

    public static let avatarPlaceholderFill = Color.white.opacity(0.08)
}

/// רקע מסך צ׳אט — גרדיאנט ירוק-שחור עדין (לא אפור מערכת).
public struct ChatBrandScreenBackground: View {
    public init() {}

    public var body: some View {
        LinearGradient(
            colors: [
                ChatBrandTheme.backgroundPrimary,
                ChatBrandTheme.backgroundSecondary,
                ChatBrandTheme.backgroundPrimary,
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .ignoresSafeArea()
    }
}
