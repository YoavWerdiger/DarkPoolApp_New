import UserNotifications

/// מצרף תמונה לפוש (חדשות / צ'אט) לפני שהוא מוצג.
/// השרת שולח את הקישור ב-data.image (אצל Expo מגיע ב-userInfo["body"]["image"]),
/// וגם ב-richContent.image — מחפשים בכולם.
final class NotificationService: UNNotificationServiceExtension {
  private var contentHandler: ((UNNotificationContent) -> Void)?
  private var bestAttempt: UNMutableNotificationContent?

  override func didReceive(
    _ request: UNNotificationRequest,
    withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
  ) {
    self.contentHandler = contentHandler
    let content = (request.content.mutableCopy() as? UNMutableNotificationContent) ?? UNMutableNotificationContent()
    bestAttempt = content

    guard let url = Self.imageURL(from: request.content.userInfo) else {
      contentHandler(content)
      return
    }

    let task = URLSession.shared.downloadTask(with: url) { [weak self] tempURL, response, _ in
      defer { self?.finish() }
      guard let self, let tempURL else { return }
      let ext = Self.fileExtension(for: response, url: url)
      let dest = FileManager.default.temporaryDirectory
        .appendingPathComponent(UUID().uuidString)
        .appendingPathExtension(ext)
      do {
        try FileManager.default.moveItem(at: tempURL, to: dest)
        let attachment = try UNNotificationAttachment(identifier: "image", url: dest, options: nil)
        self.bestAttempt?.attachments = [attachment]
      } catch {
        // בלי תמונה — הפוש עדיין מוצג
      }
    }
    task.resume()
  }

  override func serviceExtensionTimeWillExpire() {
    finish()
  }

  private func finish() {
    guard let handler = contentHandler, let content = bestAttempt else { return }
    contentHandler = nil
    handler(content)
  }

  private static func imageURL(from userInfo: [AnyHashable: Any]) -> URL? {
    var candidates: [Any?] = []
    if let body = userInfo["body"] as? [String: Any] {
      candidates.append(body["image"])
      candidates.append(body["imageUrl"])
    }
    if let rich = userInfo["richContent"] as? [String: Any] { candidates.append(rich["image"]) }
    if let rich = userInfo["_richContent"] as? [String: Any] { candidates.append(rich["image"]) }
    candidates.append(userInfo["image"])
    for case let s as String in candidates.compactMap({ $0 }) {
      if let url = URL(string: s), url.scheme == "https" || url.scheme == "http" { return url }
    }
    return nil
  }

  private static func fileExtension(for response: URLResponse?, url: URL) -> String {
    switch response?.mimeType {
    case "image/png": return "png"
    case "image/gif": return "gif"
    case "image/webp": return "webp"
    case "image/jpeg", "image/jpg": return "jpg"
    default:
      let ext = url.pathExtension.lowercased()
      return ext.isEmpty ? "jpg" : ext
    }
  }
}
