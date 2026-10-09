package expo.modules.clipboardpaste

import android.app.Activity
import android.graphics.BitmapFactory
import android.net.Uri
import android.view.View
import android.view.ViewTreeObserver
import android.widget.EditText
import androidx.core.view.ContentInfoCompat
import androidx.core.view.OnReceiveContentListener
import androidx.core.view.ViewCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

private val MIME_TYPES = arrayOf("image/*")

/**
 * תמונה מהלוח / מהמקלדת (Gboard) לשדות הטקסט של RN: ReactEditText מקבל רק טקסט.
 * מצמידים OnReceiveContentListener לכל EditText שמקבל פוקוס — מטפל גם בהדבקה וגם ב-commitContent
 * של המקלדת (AppCompatEditText). תמונות מועתקות לקאש ונשלחות ל-JS; טקסט ממשיך כרגיל.
 */
class ClipboardPasteModule : Module() {
  private var observing = false
  private var attachedActivity: Activity? = null

  private val focusListener = ViewTreeObserver.OnGlobalFocusChangeListener { _, newFocus ->
    attach(newFocus)
  }

  private val receiver = OnReceiveContentListener { _, payload ->
    if (!observing) return@OnReceiveContentListener payload
    val split = payload.partition { item -> item.uri != null && isImage(item.uri!!) }
    val images = split.first ?: return@OnReceiveContentListener payload
    val clip = images.clip
    val items = mutableListOf<Map<String, Any>>()
    val stamp = System.currentTimeMillis()
    for (i in 0 until minOf(clip.itemCount, 10)) {
      val uri = clip.getItemAt(i).uri ?: continue
      copyToCache(uri, "clipboard_${stamp}_$i")?.let { items.add(it) }
    }
    if (items.isNotEmpty()) sendEvent("onPasteImages", mapOf("items" to items))
    split.second
  }

  override fun definition() = ModuleDefinition {
    Name("ClipboardPaste")
    Events("onPasteImages")

    OnStartObserving {
      observing = true
      appContext.currentActivity?.let { activity ->
        activity.runOnUiThread { hookActivity(activity) }
      }
    }
    OnStopObserving { observing = false }
    OnActivityEntersForeground {
      appContext.currentActivity?.let { activity ->
        activity.runOnUiThread { hookActivity(activity) }
      }
    }
  }

  private fun hookActivity(activity: Activity) {
    if (attachedActivity === activity) return
    attachedActivity?.window?.decorView?.viewTreeObserver?.let {
      if (it.isAlive) it.removeOnGlobalFocusChangeListener(focusListener)
    }
    attachedActivity = activity
    val decor = activity.window?.decorView ?: return
    decor.viewTreeObserver.addOnGlobalFocusChangeListener(focusListener)
    attach(activity.currentFocus)
  }

  private fun attach(view: View?) {
    if (view !is EditText) return
    if (view.getTag(R.id.clipboard_paste_attached) == true) return
    view.setTag(R.id.clipboard_paste_attached, true)
    ViewCompat.setOnReceiveContentListener(view, MIME_TYPES, receiver)
    // המקלדת קוראת את סוגי התוכן ב-onCreateInputConnection — מאתחלים אותו מחדש
    view.post {
      val imm = view.context.getSystemService(android.content.Context.INPUT_METHOD_SERVICE)
        as? android.view.inputmethod.InputMethodManager
      if (view.hasFocus()) imm?.restartInput(view)
    }
  }

  private fun isImage(uri: Uri): Boolean {
    val ctx = appContext.reactContext ?: return false
    val type = ctx.contentResolver.getType(uri) ?: return false
    return type.startsWith("image/")
  }

  private fun copyToCache(uri: Uri, baseName: String): Map<String, Any>? {
    val ctx = appContext.reactContext ?: return null
    return try {
      val type = ctx.contentResolver.getType(uri) ?: "image/jpeg"
      val ext = when {
        type.contains("png") -> "png"
        type.contains("gif") -> "gif"
        type.contains("webp") -> "webp"
        else -> "jpg"
      }
      val file = File(ctx.cacheDir, "$baseName.$ext")
      ctx.contentResolver.openInputStream(uri)?.use { input ->
        file.outputStream().use { output -> input.copyTo(output) }
      } ?: return null
      val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
      BitmapFactory.decodeFile(file.absolutePath, bounds)
      mapOf(
        "uri" to Uri.fromFile(file).toString(),
        "width" to bounds.outWidth,
        "height" to bounds.outHeight,
      )
    } catch (e: Exception) {
      null
    }
  }
}
