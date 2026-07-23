import Foundation

/// חילוץ נתיב אחסון מ־`media_url` כמו ב־`chatSignedMediaUrl.ts`.
public enum ChatMediaURL {
    public static func storagePath(from ref: String?) -> String? {
        guard let ref, !ref.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return nil }
        let t = ref.trimmingCharacters(in: .whitespacesAndNewlines)
        if t.hasPrefix("file:") || t.hasPrefix("content:") || t.hasPrefix("blob:") { return nil }
        if !t.contains("://") {
            let uuidPath = #"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/"#
            if t.range(of: uuidPath, options: [.regularExpression, .caseInsensitive]) != nil {
                return t
            }
            return nil
        }
        guard let u = URL(string: t) else { return nil }
        let path = u.path
        if let r = path.range(of: "/object/public/chat-media/", options: .caseInsensitive) {
            return String(path[r.upperBound...]).removingPercentEncoding
        }
        if let r = path.range(of: "/object/sign/chat-media/", options: .caseInsensitive) {
            return String(path[r.upperBound...]).removingPercentEncoding
        }
        if let r = path.range(of: "/storage/v1/object/public/chat-media/", options: .caseInsensitive) {
            return String(path[r.upperBound...]).removingPercentEncoding
        }
        if let r = path.range(of: "/storage/v1/object/sign/chat-media/", options: .caseInsensitive) {
            return String(path[r.upperBound...]).removingPercentEncoding
        }
        return nil
    }
}
