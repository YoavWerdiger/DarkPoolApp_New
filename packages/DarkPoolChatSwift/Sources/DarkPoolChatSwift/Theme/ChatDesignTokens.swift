import SwiftUI

/// טוקנים מצומצמים לצ׳אט ב־Swift: **מותג + מרווחים + רדיוסים** בלבד.
/// צבעי רקע וטקסט — דרך `Color.primary` / `Color.secondary` ו־`ChatSwiftTheme` (מערכת).
public enum ChatDesignTokens {

    /// ירוק DarkPool — רק ל־accent: כפתורים, בועות "אני", ניווט, סטוריז.
    public static let brand = Color(red: 0, green: 200 / 255, blue: 5 / 255)

    public enum Spacing {
        public static let xxs: CGFloat = 2
        public static let xs: CGFloat = 4
        public static let sm: CGFloat = 8
        public static let md: CGFloat = 12
        public static let base: CGFloat = 16
        public static let lg: CGFloat = 20
        public static let xl: CGFloat = 24
        public static let xxl: CGFloat = 32
    }

    public enum Radius {
        /// בועות הודעה — קרוב ל־Messages (עיגול נדיב).
        public static let bubble: CGFloat = 20
        public static let xs: CGFloat = 4
        public static let sm: CGFloat = 8
        public static let md: CGFloat = 12
        public static let lg: CGFloat = 16
        public static let xl: CGFloat = 20
    }

    public enum Layout {
        public static let screenPadding: CGFloat = 16
        public static let composerMinHeight: CGFloat = 48
    }
}
