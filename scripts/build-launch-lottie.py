"""
בונה את קבצי ה-Lottie של מסך הפתיחה מתוך שכבות הלוגו ב-assets/launch.

  python3 scripts/build-launch-lottie.py

פלט:
  assets/launch/launch-logo-dark.json   — אמבלם + DARKPOOL + סלוגן לבן (60fps, פעם אחת)
  assets/launch/launch-logo-light.json  — אותו דבר, סלוגן בצבע טקסט בהיר-מצב
  assets/launch/launch-dots.json        — שלוש נקודות טעינה בלופ (1 שנ')

הקבצים ניתנים לפתיחה ב-LottieFiles / After Effects (Bodymovin) לעריכה ידנית.
גיאומטריה: קומפוזיציה 300×600, האמבלם 200×200 במרכז (150,300) = בדיוק ה-splash הנייטיב.
"""
import base64
import io
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
LAUNCH = ROOT / 'assets' / 'launch'

FPS = 60
COMP_W, COMP_H = 300, 600
CX, CY = COMP_W / 2, COMP_H / 2

EMBLEM = 200
EMBLEM_TOP, EMBLEM_BOTTOM = 0.243, 0.825
WM_W = 236
TAG_W = 180
GAP_EMBLEM, GAP_TAG = 20, 11
LIGHT_TEXT = (0x1E, 0x1A, 0x24)

# Apple-like ease (cubic-bezier .2,0,0,1 / out .4,0,.2,1)
EASE_O = {'x': [0.4], 'y': [0]}
EASE_I = {'x': [0.2], 'y': [1]}


def png_data_uri(img: Image.Image) -> str:
    buf = io.BytesIO()
    img.save(buf, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()


def wordmark() -> Image.Image:
    metas = [(0, 147), (133, 170), (304, 143), (451, 166), (618, 141), (761, 157), (916, 157), (1076, 124)]
    out = Image.new('RGBA', (1200, 158), (0, 0, 0, 0))
    for i, (x, _) in enumerate(metas):
        out.alpha_composite(Image.open(LAUNCH / f'wm-{i}.png').convert('RGBA'), (x, 0))
    out.alpha_composite(Image.open(LAUNCH / 'wm-wick.png').convert('RGBA'), (455, 0))
    return out


def emblem() -> Image.Image:
    out = Image.open(LAUNCH / 'emblem-bear.png').convert('RGBA')
    out.alpha_composite(Image.open(LAUNCH / 'emblem-bull.png').convert('RGBA'))
    return out


def tinted(img: Image.Image, rgb) -> Image.Image:
    solid = Image.new('RGBA', img.size, rgb + (0,))
    solid.putalpha(img.getchannel('A'))
    return solid


def kf(frames_values, dims=1):
    """[(t, value)] → Lottie keyframes עם ease אחיד."""
    ks = []
    for idx, (t, v) in enumerate(frames_values):
        s = v if isinstance(v, list) else [v]
        k = {'t': t, 's': s}
        if idx < len(frames_values) - 1:
            k['o'] = {'x': EASE_O['x'] * dims, 'y': EASE_O['y'] * dims}
            k['i'] = {'x': EASE_I['x'] * dims, 'y': EASE_I['y'] * dims}
        ks.append(k)
    return {'a': 1, 'k': ks}


def static(v):
    return {'a': 0, 'k': v}


def image_layer(ind, name, ref, w, h, display_w, opacity, position, op):
    scale = display_w / w * 100
    return {
        'ddd': 0, 'ind': ind, 'ty': 2, 'nm': name, 'refId': ref, 'sr': 1,
        'ks': {
            'o': opacity,
            'r': static(0),
            'p': position,
            'a': static([w / 2, h / 2, 0]),
            's': static([scale, scale, 100]),
        },
        'ao': 0, 'ip': 0, 'op': op, 'st': 0, 'bm': 0,
    }


def build_logo(tag_img: Image.Image) -> dict:
    em, wm = emblem(), wordmark()
    op = 72  # 1.2s; הפריים האחרון נשאר על המסך

    wm_h = WM_W * wm.height / wm.width
    tag_h = TAG_W * tag_img.height / tag_img.width

    # מרכוז אופטי של ה-lockup כולו → האמבלם עולה פעם אחת בעדינות
    vis_top = CY - (0.5 - EMBLEM_TOP) * EMBLEM
    vis_bottom = CY + (EMBLEM_BOTTOM - 0.5) * EMBLEM
    lock_h = (vis_bottom - vis_top) + GAP_EMBLEM + wm_h + GAP_TAG + tag_h
    lift = (vis_top + lock_h / 2) - CY + 10  # 10 = הרמה אופטית
    em_y_end = CY - lift
    wm_cy = em_y_end + (EMBLEM_BOTTOM - 0.5) * EMBLEM + GAP_EMBLEM + wm_h / 2
    tag_cy = wm_cy + wm_h / 2 + GAP_TAG + tag_h / 2

    assets = [
        {'id': 'emblem', 'w': em.width, 'h': em.height, 'u': '', 'p': png_data_uri(em), 'e': 1},
        {'id': 'wordmark', 'w': wm.width, 'h': wm.height, 'u': '', 'p': png_data_uri(wm), 'e': 1},
        {'id': 'tagline', 'w': tag_img.width, 'h': tag_img.height, 'u': '', 'p': png_data_uri(tag_img), 'e': 1},
    ]
    layers = [
        image_layer(
            1, 'Emblem', 'emblem', em.width, em.height, EMBLEM,
            static(100),
            kf([(6, [CX, CY, 0]), (48, [CX, em_y_end, 0])], dims=3),
            op,
        ),
        image_layer(
            2, 'Wordmark', 'wordmark', wm.width, wm.height, WM_W,
            kf([(22, 0), (46, 100)]),
            kf([(22, [CX, wm_cy + 8, 0]), (50, [CX, wm_cy, 0])], dims=3),
            op,
        ),
        image_layer(
            3, 'Tagline', 'tagline', tag_img.width, tag_img.height, TAG_W,
            kf([(32, 0), (56, 82)]),
            kf([(32, [CX, tag_cy + 6, 0]), (60, [CX, tag_cy, 0])], dims=3),
            op,
        ),
    ]
    return {
        'v': '5.9.0', 'fr': FPS, 'ip': 0, 'op': op, 'w': COMP_W, 'h': COMP_H,
        'nm': 'DarkPool Launch Logo', 'ddd': 0, 'assets': assets, 'layers': layers,
        'markers': [], 'meta': {'tagline_bottom': tag_cy + tag_h / 2},
    }


def build_dots() -> dict:
    """שלוש נקודות, גל אטימות+סקייל מימין לשמאל (RTL), לופ חלק של 60 פריימים."""
    op = 60
    size, gap = 6, 9
    w, h = size * 3 + gap * 2 + 8, size + 8
    green = [0, 200 / 255, 5 / 255, 1]  # SoftUI.brand
    layers = []
    for i in range(3):
        x = w - 4 - size / 2 - i * (size + gap)  # i=0 הימנית
        peak = 8 + i * 9
        o = kf([(0, 28), (peak, 100), (peak + 18, 28), (op, 28)])
        s = kf([(0, [100, 100, 100]), (peak, [118, 118, 100]), (peak + 18, [100, 100, 100]), (op, [100, 100, 100])], dims=3)
        layers.append({
            'ddd': 0, 'ind': i + 1, 'ty': 4, 'nm': f'Dot {i + 1}', 'sr': 1,
            'ks': {'o': o, 'r': static(0), 'p': static([x, h / 2, 0]), 'a': static([0, 0, 0]), 's': s},
            'ao': 0,
            'shapes': [{
                'ty': 'gr', 'nm': 'dot',
                'it': [
                    {'ty': 'el', 'nm': 'e', 'p': static([0, 0]), 's': static([size, size]), 'd': 1},
                    {'ty': 'fl', 'nm': 'f', 'c': static(green), 'o': static(100), 'r': 1},
                    {'ty': 'tr', 'p': static([0, 0]), 'a': static([0, 0]), 's': static([100, 100]),
                     'r': static(0), 'o': static(100), 'sk': static(0), 'sa': static(0)},
                ],
            }],
            'ip': 0, 'op': op, 'st': 0, 'bm': 0,
        })
    return {'v': '5.9.0', 'fr': FPS, 'ip': 0, 'op': op, 'w': w, 'h': h,
            'nm': 'DarkPool Launch Dots', 'ddd': 0, 'assets': [], 'layers': layers, 'markers': []}


def main():
    tag = Image.open(LAUNCH / 'tagline.png').convert('RGBA')
    dark = build_logo(tag)
    light = build_logo(tinted(tag, LIGHT_TEXT))
    dots = build_dots()
    for name, data in [('launch-logo-dark', dark), ('launch-logo-light', light), ('launch-dots', dots)]:
        (LAUNCH / f'{name}.json').write_text(json.dumps(data, separators=(',', ':')))
    print('tagline bottom (comp px):', round(dark['meta']['tagline_bottom'], 1),
          '| dots comp:', dots['w'], 'x', dots['h'])


if __name__ == '__main__':
    main()
