import ExpoModulesCore
import ObjectiveC
import UIKit

/// הדבקת תמונה מהלוח לשדות הטקסט של RN: «הדבק» בתפריט/במקלדת קורא ל-paste: על השדה,
/// ו-RCTUITextView/RCTUITextField מדביקים רק טקסט — תמונה נבלעת. כאן עוטפים את paste:
/// (רק במחלקות של RN, לא ב-UITextView הכללי): כשבלוח יש תמונה ו-JS מאזין — שומרים לקובץ
/// ושולחים onPasteImages. הדבקה יזומה ע"י המשתמש → בלי בקשת הרשאת הדבקה של iOS.
public class ClipboardPasteModule: Module {
  static weak var shared: ClipboardPasteModule?
  static var observing = false
  private static var installed = false

  public func definition() -> ModuleDefinition {
    Name("ClipboardPaste")
    Events("onPasteImages")

    OnCreate {
      ClipboardPasteModule.shared = self
      DispatchQueue.main.async { ClipboardPasteModule.install() }
    }
    OnStartObserving { ClipboardPasteModule.observing = true }
    OnStopObserving { ClipboardPasteModule.observing = false }
  }

  // MARK: - swizzle

  private static func install() {
    guard !installed else { return }
    installed = true
    for name in ["RCTUITextView", "RCTUITextField"] {
      guard let cls = NSClassFromString(name) else { continue }
      wrapPaste(cls)
      wrapCanPerform(cls)
    }
  }

  /// מוסיף override במחלקה עצמה (class_addMethod) — לא משנה את המימוש של UITextView לכולם
  private static func override(_ cls: AnyClass, _ sel: Selector, _ block: Any) -> IMP? {
    guard let method = class_getInstanceMethod(cls, sel) else { return nil }
    let original = method_getImplementation(method)
    let imp = imp_implementationWithBlock(block)
    if !class_addMethod(cls, sel, imp, method_getTypeEncoding(method)) {
      method_setImplementation(method, imp)
    }
    return original
  }

  private static func wrapPaste(_ cls: AnyClass) {
    typealias Fn = @convention(c) (AnyObject, Selector, Any?) -> Void
    let sel = #selector(UIResponderStandardEditActions.paste(_:))
    var original: Fn?
    let block: @convention(block) (AnyObject, Any?) -> Void = { obj, sender in
      if handleImagePaste() { return }
      original?(obj, sel, sender)
    }
    if let imp = override(cls, sel, block) {
      original = unsafeBitCast(imp, to: Fn.self)
    }
  }

  private static func wrapCanPerform(_ cls: AnyClass) {
    typealias Fn = @convention(c) (AnyObject, Selector, Selector, Any?) -> Bool
    let sel = #selector(UIResponder.canPerformAction(_:withSender:))
    var original: Fn?
    let block: @convention(block) (AnyObject, Selector, Any?) -> Bool = { obj, action, sender in
      if action == #selector(UIResponderStandardEditActions.paste(_:)),
         observing, UIPasteboard.general.hasImages {
        return true
      }
      return original?(obj, sel, action, sender) ?? false
    }
    if let imp = override(cls, sel, block) {
      original = unsafeBitCast(imp, to: Fn.self)
    }
  }

  // MARK: - paste

  /// true = טופל (תמונה נשלחה ל-JS); false = הדבקת טקסט רגילה
  private static func handleImagePaste() -> Bool {
    guard observing, let module = shared else { return false }
    let board = UIPasteboard.general
    guard board.hasImages, let images = board.images, !images.isEmpty else { return false }

    let stamp = Int(Date().timeIntervalSince1970 * 1000)
    var items: [[String: Any]] = []
    for (index, image) in images.prefix(10).enumerated() {
      guard let data = image.jpegData(compressionQuality: 0.9) else { continue }
      let url = FileManager.default.temporaryDirectory
        .appendingPathComponent("clipboard_\(stamp)_\(index).jpg")
      do {
        try data.write(to: url)
        items.append([
          "uri": url.absoluteString,
          "width": image.size.width * image.scale,
          "height": image.size.height * image.scale,
        ])
      } catch {
        continue
      }
    }
    guard !items.isEmpty else { return false }
    module.sendEvent("onPasteImages", ["items": items])
    return true
  }
}
