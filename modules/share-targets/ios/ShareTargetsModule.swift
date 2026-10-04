import ExpoModulesCore
import Intents

public class ShareTargetsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ShareTargets")

    AsyncFunction("donate") { (id: String, name: String, iconUri: String?, _: String, promise: Promise) in
      let intent = INSendMessageIntent(
        recipients: nil,
        outgoingMessageType: .outgoingMessageText,
        content: nil,
        speakableGroupName: INSpeakableString(spokenPhrase: name),
        conversationIdentifier: id,
        serviceName: nil,
        sender: nil,
        attachments: nil
      )
      if let iconUri, let url = URL(string: iconUri), url.isFileURL,
         let data = try? Data(contentsOf: url) {
        intent.setImage(INImage(imageData: data), forParameterNamed: \INSendMessageIntent.speakableGroupName)
      }
      let interaction = INInteraction(intent: intent, response: nil)
      interaction.direction = .outgoing
      interaction.groupIdentifier = id
      interaction.donate { error in
        if let error {
          promise.reject("ERR_SHARE_TARGET_DONATE", error.localizedDescription)
        } else {
          promise.resolve(nil)
        }
      }
    }

    AsyncFunction("remove") { (id: String, promise: Promise) in
      INInteraction.delete(with: id) { _ in promise.resolve(nil) }
    }

    AsyncFunction("removeAll") { (promise: Promise) in
      INInteraction.deleteAll { _ in promise.resolve(nil) }
    }

    // iOS: הקבוצה מגיעה מה-Share Extension כפרמטר target ב-URL.
    Function("consumeShareTargetId") { () -> String? in
      return nil
    }
  }
}
