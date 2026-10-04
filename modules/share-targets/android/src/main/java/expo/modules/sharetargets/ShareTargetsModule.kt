package expo.modules.sharetargets

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.Rect
import android.graphics.RectF
import android.net.Uri
import androidx.core.app.Person
import androidx.core.content.pm.ShortcutInfoCompat
import androidx.core.content.pm.ShortcutManagerCompat
import androidx.core.graphics.drawable.IconCompat
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val ICON_PX = 192

class ShareTargetsModule : Module() {
  private var pendingTargetId: String? = null
  private var launchIntentChecked = false

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  /** חייב להתאים ל-share_targets.xml */
  private fun category(ctx: Context) = "${ctx.packageName}.SHARE_TARGET"

  private fun shortcutIdFrom(intent: Intent?): String? {
    if (intent == null) return null
    if (intent.action != Intent.ACTION_SEND && intent.action != Intent.ACTION_SEND_MULTIPLE) return null
    return intent.getStringExtra(ShortcutManagerCompat.EXTRA_SHORTCUT_ID)
  }

  override fun definition() = ModuleDefinition {
    Name("ShareTargets")

    OnNewIntent { intent ->
      pendingTargetId = shortcutIdFrom(intent)
    }

    Function("consumeShareTargetId") {
      if (!launchIntentChecked) {
        launchIntentChecked = true
        if (pendingTargetId == null) {
          pendingTargetId = shortcutIdFrom(appContext.currentActivity?.intent)
        }
      }
      val id = pendingTargetId
      pendingTargetId = null
      id
    }

    AsyncFunction("donate") { id: String, name: String, iconUri: String?, launchUrl: String ->
      val ctx = context
      val icon = iconUri?.let { loadCircleBitmap(it) }?.let { IconCompat.createWithBitmap(it) }
        ?: IconCompat.createWithResource(ctx, ctx.applicationInfo.icon)
      val person = Person.Builder()
        .setKey(id)
        .setName(name)
        .setIcon(icon)
        .build()
      val launch = Intent(Intent.ACTION_VIEW, Uri.parse(launchUrl)).setPackage(ctx.packageName)
      val shortcut = ShortcutInfoCompat.Builder(ctx, id)
        .setShortLabel(name)
        .setLongLived(true)
        .setPerson(person)
        .setIcon(icon)
        .setCategories(setOf(category(ctx)))
        .setIntent(launch)
        .build()
      ShortcutManagerCompat.pushDynamicShortcut(ctx, shortcut)
    }

    AsyncFunction("remove") { id: String ->
      val ctx = context
      ShortcutManagerCompat.removeDynamicShortcuts(ctx, listOf(id))
      ShortcutManagerCompat.removeLongLivedShortcuts(ctx, listOf(id))
    }

    AsyncFunction("removeAll") {
      val ctx = context
      val ids = ShortcutManagerCompat.getShortcuts(
        ctx,
        ShortcutManagerCompat.FLAG_MATCH_DYNAMIC or ShortcutManagerCompat.FLAG_MATCH_CACHED,
      ).map { it.id }
      ShortcutManagerCompat.removeAllDynamicShortcuts(ctx)
      if (ids.isNotEmpty()) ShortcutManagerCompat.removeLongLivedShortcuts(ctx, ids)
    }
  }

  private fun loadCircleBitmap(uri: String): Bitmap? {
    val path = Uri.parse(uri).path ?: return null
    val source = BitmapFactory.decodeFile(path) ?: return null
    val side = minOf(source.width, source.height)
    val left = (source.width - side) / 2
    val top = (source.height - side) / 2
    val out = Bitmap.createBitmap(ICON_PX, ICON_PX, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(out)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
    val dst = RectF(0f, 0f, ICON_PX.toFloat(), ICON_PX.toFloat())
    canvas.drawOval(dst, paint)
    paint.xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_IN)
    canvas.drawBitmap(source, Rect(left, top, left + side, top + side), dst, paint)
    source.recycle()
    return out
  }
}
