import Intents
import UserNotifications

/// לפני שהפוש מוצג:
/// - הודעת צ'אט → Communication Notification (כמו וואטסאפ): תמונת הקבוצה/השולח גדולה,
///   ואייקון DarkPool קטן בפינה. בונים INSendMessageIntent ומעדכנים את התוכן ממנו.
/// - כל השאר (חדשות וכו') → תמונה מצורפת כמו קודם.
/// השרת שולח את הנתונים ב-data (אצל Expo מגיע ב-userInfo["body"]), והתמונה גם ב-richContent.image.
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

    let data = Self.payload(from: request.content.userInfo)
    if (data["type"] as? String) == "chat_message" {
      handleChatMessage(data: data, userInfo: request.content.userInfo)
      return
    }

    guard let url = Self.imageURL(from: request.content.userInfo) else {
      finish()
      return
    }
    download(url) { [weak self] file in
      if let file, let attachment = try? UNNotificationAttachment(identifier: "image", url: file, options: nil) {
        self?.bestAttempt?.attachments = [attachment]
      }
      self?.finish()
    }
  }

  override func serviceExtensionTimeWillExpire() {
    finish()
  }

  // MARK: - Chat (Communication Notification)

  private func handleChatMessage(data: [String: Any], userInfo: [AnyHashable: Any]) {
    let groupId = (data["group_id"] as? String) ?? ""
    let groupName = (data["group_name"] as? String) ?? ""
    let senderId = (data["sender_id"] as? String) ?? "sender"
    let senderName = (data["sender_name"] as? String) ?? ""
    // התמונה הבטוחה מהשרת (ציבורית) — קודם היא, אחרת ה-avatar הגולמי
    let avatarURL = Self.imageURL(from: userInfo)
      ?? Self.httpURL(data["avatar_url"])
      ?? Self.httpURL(data["group_avatar"])
      ?? Self.httpURL(data["sender_avatar"])

    let build: (INImage?) -> Void = { [weak self] avatar in
      guard let self, let content = self.bestAttempt else { return }
      let sender = INPerson(
        personHandle: INPersonHandle(value: senderId, type: .unknown),
        nameComponents: nil,
        displayName: senderName.isEmpty ? nil : senderName,
        image: groupName.isEmpty ? avatar : nil,
        contactIdentifier: nil,
        customIdentifier: senderId
      )
      let me = INPerson(
        personHandle: INPersonHandle(value: "me", type: .unknown),
        nameComponents: nil,
        displayName: nil,
        image: nil,
        contactIdentifier: nil,
        customIdentifier: "me",
        isMe: true
      )
      let isGroup = !groupName.isEmpty
      let intent = INSendMessageIntent(
        recipients: isGroup ? [me, sender] : [me],
        outgoingMessageType: .outgoingMessageText,
        content: content.body,
        speakableGroupName: isGroup ? INSpeakableString(spokenPhrase: groupName) : nil,
        conversationIdentifier: groupId.isEmpty ? nil : groupId,
        serviceName: nil,
        sender: sender,
        attachments: nil
      )
      if isGroup, let avatar {
        // תמונת הקבוצה היא התמונה הגדולה; אייקון DarkPool מופיע קטן בפינה
        intent.setImage(avatar, forParameterNamed: \.speakableGroupName)
      }
      let interaction = INInteraction(intent: intent, response: nil)
      interaction.direction = .incoming
      interaction.donate { _ in
        if let updated = try? content.updating(from: intent) {
          self.finish(with: updated)
        } else {
          self.finish()
        }
      }
    }

    guard let avatarURL else {
      build(nil)
      return
    }
    download(avatarURL) { file in
      let image = file.flatMap { try? Data(contentsOf: $0) }.map { INImage(imageData: $0) }
      build(image)
    }
  }

  // MARK: - Helpers

  private func download(_ url: URL, completion: @escaping (URL?) -> Void) {
    URLSession.shared.downloadTask(with: url) { tempURL, response, _ in
      guard let tempURL else { return completion(nil) }
      let dest = FileManager.default.temporaryDirectory
        .appendingPathComponent(UUID().uuidString)
        .appendingPathExtension(Self.fileExtension(for: response, url: url))
      do {
        try FileManager.default.moveItem(at: tempURL, to: dest)
        completion(dest)
      } catch {
        completion(nil)
      }
    }.resume()
  }

  private func finish(with content: UNNotificationContent? = nil) {
    guard let handler = contentHandler else { return }
    guard let final = content ?? bestAttempt else { return }
    contentHandler = nil
    handler(final)
  }

  private static func payload(from userInfo: [AnyHashable: Any]) -> [String: Any] {
    if let body = userInfo["body"] as? [String: Any] { return body }
    if let body = userInfo["body"] as? String,
       let data = body.data(using: .utf8),
       let dict = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] {
      return dict
    }
    if let data = userInfo["data"] as? [String: Any] { return data }
    return [:]
  }

  private static func httpURL(_ value: Any?) -> URL? {
    guard let s = value as? String, let url = URL(string: s),
          url.scheme == "https" || url.scheme == "http" else { return nil }
    return url
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
    for value in candidates {
      if let url = httpURL(value) { return url }
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
