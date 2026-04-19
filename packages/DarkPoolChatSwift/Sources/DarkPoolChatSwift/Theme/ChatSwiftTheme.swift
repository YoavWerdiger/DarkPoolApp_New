import SwiftUI

#if canImport(UIKit)
import UIKit
#endif
#if canImport(AppKit)
import AppKit
#endif

/// אסתטיקה נייטיבית של SwiftUI / Apple HIG — צבעים דינמיים (Light/Dark), בלי hex קבועים לרקע וטקסט.
/// הירוק נשאר רק כ־**accent מותג** (`ChatDesignTokens.brand`).
public enum ChatSwiftTheme {

    public static var screenBackground: Color {
        #if os(iOS)
        Color(UIColor.systemGroupedBackground)
        #elseif os(macOS)
        Color(nsColor: .windowBackgroundColor)
        #else
        Color.gray.opacity(0.12)
        #endif
    }

    public static var secondaryGrouped: Color {
        #if os(iOS)
        Color(UIColor.secondarySystemGroupedBackground)
        #elseif os(macOS)
        Color(nsColor: .controlBackgroundColor)
        #else
        Color.gray.opacity(0.18)
        #endif
    }

    public static var tertiaryGrouped: Color {
        #if os(iOS)
        Color(UIColor.tertiarySystemGroupedBackground)
        #elseif os(macOS)
        Color(nsColor: .underPageBackgroundColor)
        #else
        Color.gray.opacity(0.22)
        #endif
    }

    public static var separator: Color {
        #if os(iOS)
        Color(UIColor.separator)
        #elseif os(macOS)
        Color(nsColor: .separatorColor)
        #else
        Color.gray.opacity(0.3)
        #endif
    }

    public static var fill: Color {
        #if os(iOS)
        Color(UIColor.systemFill)
        #elseif os(macOS)
        Color(nsColor: .controlColor)
        #else
        Color.gray.opacity(0.25)
        #endif
    }

    public static var tertiaryLabel: Color {
        #if os(iOS)
        Color(UIColor.tertiaryLabel)
        #elseif os(macOS)
        Color(nsColor: .tertiaryLabelColor)
        #else
        Color.secondary.opacity(0.75)
        #endif
    }

    public static var destructive: Color {
        #if os(iOS)
        Color(UIColor.systemRed)
        #elseif os(macOS)
        Color(nsColor: .systemRed)
        #else
        Color.red
        #endif
    }
}

/// רקע מסך צ׳אט — אסתטיקת DarkPool (ירוק-שחור), לא רקע מערכת אפור.
public struct ChatScreenBackground: View {
    public init() {}

    public var body: some View {
        ChatBrandScreenBackground()
    }
}
