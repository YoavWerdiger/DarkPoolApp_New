import Foundation

/// זמן יחסי לרשימת צ׳אטים (עברית, מקוצר).
public enum ChatRelativeTimeFormatter {
    public static func string(for date: Date) -> String {
        let f = RelativeDateTimeFormatter()
        f.locale = Locale(identifier: "he_IL")
        f.unitsStyle = .abbreviated
        return f.localizedString(for: date, relativeTo: Date())
    }
}
