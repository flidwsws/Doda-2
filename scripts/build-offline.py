#!/usr/bin/env python3
"""Build a portable, self-contained BONKAi HTML file and a shareable ZIP.

Run from any directory with Python 3. No third-party packages or network access.
"""
from __future__ import annotations

import base64
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
HTML_OUT = ROOT / "offline" / "BONKAi.html"
ZIP_OUT = ROOT / "downloads" / "BONKAi-Offline.zip"

INSTRUCTIONS = """BONKAi — локальная версия

КАК ЗАПУСТИТЬ
1. Полностью распакуйте BONKAi-Offline.zip в любую папку на компьютере.
2. Откройте папку BONKAi и дважды нажмите BONKAi.html.
3. Если файл открылся в редакторе, выберите «Открыть с помощью» и браузер.

Подходит для Windows, macOS и Linux с современным Chrome, Edge, Firefox
или Safari. Сервер, Python, Node.js, аккаунт и подключение к интернету
для игры не нужны. Весь код, шрифты и графика включены в HTML-файл.

УПРАВЛЕНИЕ
WASD или стрелки — движение.
Пробел — рывок. ESC — пауза.
Атаки автоматические. Собирайте ромбы опыта и кресты лечения.
Грим — воин. Морвен — друид. Нокс — разбойник.
Выживите пять минут и победите всех хранителей.

КАРТА МИРА
Площадь мира увеличена в девять раз. Доступны пять областей:
Пепельный лес, Старое кладбище, Руины собора, Безмолвная пустошь
и Мёртвая низина. На мини-карте белая точка — герой, квадраты —
центры областей. Счётчик показывает посещённые области за забег.

РЕКОРДЫ
Рекорды сохраняются в хранилище браузера, если оно доступно для локальных
файлов. В приватном режиме или при запрете хранилища они могут не сохраняться.
Локальные рекорды не синхронизируются с онлайн-версией и другими компьютерами.
Сохраняйте файл в одной папке и пользуйтесь одним браузером для своих рекордов.

ПЕРЕДАТЬ ДРУГУ
Отправьте ZIP-архив или BONKAi.html. Ничего дополнительно скачивать не нужно.
Лицензия встроенного шрифта также включена внутрь HTML и FONT-LICENSE.txt.

Онлайн-версия: https://dodabonk.aglowchalk.chatgpt.site
Исходники: https://github.com/flidwsws/Doda-2
"""


def resource(path: str) -> Path:
    resolved = (DIST / path.split("?", 1)[0]).resolve()
    resolved.relative_to(DIST.resolve())
    if not resolved.is_file():
        raise ValueError(f"Missing local resource: {path}")
    return resolved


def inline_css(match: re.Match) -> str:
    css_file = resource(match.group(1))
    css = css_file.read_text(encoding="utf-8")

    def inline_url(url_match: re.Match) -> str:
        url = url_match.group(2)
        if url.startswith("data:"):
            return url_match.group(0)
        font = (css_file.parent / url).resolve()
        font.relative_to(DIST.resolve())
        if font.suffix != ".woff2":
            raise ValueError(f"Unsupported CSS resource: {url}")
        data = base64.b64encode(font.read_bytes()).decode("ascii")
        return f"url('data:font/woff2;base64,{data}')"

    css = re.sub(r"url\((['\"]?)([^)'\"\s]+)\1\)", inline_url, css)
    if "@import" in css or re.search(r"</style", css, re.I):
        raise ValueError("Stylesheet cannot be safely embedded")
    return f"<style>\n{css}\n</style>"


class ResourceCheck(HTMLParser):
    """Reject a bundle that could still load code, styles, images or frames."""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        for name in ("src", "srcset", "poster"):
            if values.get(name) and not values[name].startswith("data:"):
                raise ValueError(f"External resource remains: {tag}[{name}]")
        if tag == "link" and values.get("href"):
            raise ValueError("External link resource remains")


def make_bundle() -> str:
    html = (DIST / "index.html").read_text(encoding="utf-8")
    html = re.sub(r'<link\s+rel="stylesheet"\s+href="([^"]+)"\s*/?>', inline_css, html)
    script_pattern = r'<script\s+src="([^"]+)"\s*>\s*</script>'

    def inline_script(match: re.Match) -> str:
        script = resource(match.group(1)).read_text(encoding="utf-8")
        if re.search(r"</script", script, re.I):
            raise ValueError("Script cannot be safely embedded")
        return '<script id="game-code">\n' + script + "\n</script>"

    html, script_count = re.subn(script_pattern, inline_script, html)
    if script_count != 1:
        raise ValueError("Expected exactly one game script")
    html = html.replace("<title>BONKAi — ещё один забег</title>", "<title>BONKAi — локальная версия</title>")
    html = html.replace('href="./"', 'href=""')
    html = re.sub(r"ЧЁРНО-БЕЛЫЙ МИР · V[0-9.]+", "ЛОКАЛЬНАЯ ВЕРСИЯ · OFFLINE", html)
    html = html.replace("ВОЙДИ В ТУМАН. ПЕРЕЖИВИ ПЯТЬ МИНУТ.", "РАБОТАЕТ БЕЗ ИНТЕРНЕТА. ВЕСЬ МИР — В ОДНОМ ФАЙЛЕ.")
    license_text = (DIST / "assets" / "OFL.txt").read_text(encoding="utf-8")
    license_json = json.dumps(license_text, ensure_ascii=False).replace("<", "\\u003c")
    html = html.replace("</body>", '<script id="font-license" type="application/json">' + license_json + "</script>\n</body>")
    ResourceCheck().feed(html)
    if len(re.findall(r"data:font/woff2;base64,", html)) != 2:
        raise ValueError("Both pixel font subsets must be embedded")
    return html


def main() -> None:
    html = make_bundle()
    HTML_OUT.parent.mkdir(parents=True, exist_ok=True)
    ZIP_OUT.parent.mkdir(parents=True, exist_ok=True)
    HTML_OUT.write_text(html, encoding="utf-8")
    entries = {
        "BONKAi/BONKAi.html": html.encode("utf-8"),
        "BONKAi/README-RU.txt": INSTRUCTIONS.encode("utf-8"),
        "BONKAi/FONT-LICENSE.txt": (DIST / "assets" / "OFL.txt").read_bytes(),
    }
    with ZipFile(ZIP_OUT, "w") as archive:
        for name, content in entries.items():
            info = ZipInfo(name)
            info.compress_type = ZIP_DEFLATED
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            archive.writestr(info, content)
    with ZipFile(ZIP_OUT) as archive:
        if archive.testzip() is not None:
            raise ValueError("ZIP verification failed")
    print(json.dumps({"html": str(HTML_OUT), "zip": str(ZIP_OUT), "html_bytes": HTML_OUT.stat().st_size, "zip_bytes": ZIP_OUT.stat().st_size, "external_resources": 0}))


if __name__ == "__main__":
    main()
