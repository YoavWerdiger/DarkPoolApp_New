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
    let type = (data["type"] as? String) ?? ""
    if (data["push_style"] as? String) == "communication" || type == "chat_message" {
      handleCommunication(data: data, userInfo: request.content.userInfo)
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

  // MARK: - Communication Notification (כל סוגי הפושים, כמו וואטסאפ)

  /// תמונה גדולה = "השולח" (קבוצה / מקור / טיקר / אדם / DarkPool), אייקון האפליקציה קטן בפינה.
  /// תמונה מצורפת (למשל תמונת החדשה) נשארת כקובץ מצורף.
  private func handleCommunication(data: [String: Any], userInfo: [AnyHashable: Any]) {
    guard let content = bestAttempt else { return finish() }
    let type = (data["type"] as? String) ?? ""
    let groupName = (data["group_name"] as? String) ?? ""
    let isGroupChat = type == "chat_message" && !groupName.isEmpty
    let senderId = (data["sender_id"] as? String) ?? (data["conversation_id"] as? String) ?? "darkpool"
    let display = (data["sender_display"] as? String) ?? ""
    let senderName = isGroupChat
      ? ((data["sender_name"] as? String) ?? "")
      : (display.isEmpty ? content.title : display)
    let conversationId = (data["conversation_id"] as? String)
      ?? (data["group_id"] as? String).map { "chat-\($0)" }
    let avatarURL = Self.httpURL(data["avatar_url"])
      ?? (type == "chat_message" ? Self.imageURL(from: userInfo) : nil)
    // תמונה מצורפת: רק כשהיא לא האווטאר עצמו (בצ'אט ה-richContent הוא תמונת הקבוצה)
    let attachmentURL: URL? = {
      guard type != "chat_message", let url = Self.imageURL(from: userInfo) else { return nil }
      return url == avatarURL ? nil : url
    }()

    // שיחה אחד-על-אחד: הכותרת היא השולח — את הכותרת/תת-הכותרת המקוריות מכניסים לגוף
    if !isGroupChat {
      var lines: [String] = []
      if !content.title.isEmpty && content.title != senderName { lines.append(content.title) }
      if !content.subtitle.isEmpty && content.subtitle != senderName { lines.append(content.subtitle) }
      if !content.body.isEmpty { lines.append(content.body) }
      content.body = lines.joined(separator: "\n")
      content.subtitle = ""
    }

    let group = DispatchGroup()
    var avatar: INImage?
    if let avatarURL {
      group.enter()
      download(avatarURL) { file in
        avatar = file.flatMap { try? Data(contentsOf: $0) }.map { INImage(imageData: $0) }
        group.leave()
      }
    }
    if let attachmentURL {
      group.enter()
      download(attachmentURL) { [weak self] file in
        if let file, let att = try? UNNotificationAttachment(identifier: "image", url: file, options: nil) {
          self?.bestAttempt?.attachments = [att]
        }
        group.leave()
      }
    }

    group.notify(queue: .global()) { [weak self] in
      guard let self else { return }
      let sender = INPerson(
        personHandle: INPersonHandle(value: senderId, type: .unknown),
        nameComponents: nil,
        displayName: senderName.isEmpty ? nil : senderName,
        image: isGroupChat ? nil : avatar,
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
      let intent = INSendMessageIntent(
        recipients: isGroupChat ? [me, sender] : [me],
        outgoingMessageType: .outgoingMessageText,
        content: content.body,
        speakableGroupName: isGroupChat ? INSpeakableString(spokenPhrase: groupName) : nil,
        conversationIdentifier: conversationId,
        serviceName: nil,
        sender: sender,
        attachments: nil
      )
      if isGroupChat, let avatar {
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
