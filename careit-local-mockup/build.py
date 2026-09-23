"""외부 패키지 없이 전달용 단일 HTML을 생성합니다: python build.py"""
from pathlib import Path
import base64

ROOT = Path(__file__).resolve().parent
html = (ROOT / 'index.html').read_text(encoding='utf-8')
lucide_license = (ROOT / 'assets/LUCIDE-LICENSE.txt').read_text(encoding='utf-8')
html = html.replace('<head>', '<head>\n<!-- Third-party icon: Lucide pencil, https://lucide.dev/icons/pencil\n' + lucide_license + '\n-->')
css = (ROOT / 'assets/original.css').read_text(encoding='utf-8')
font = base64.b64encode((ROOT / 'assets/PretendardVariable.woff2').read_bytes()).decode()
logo = base64.b64encode((ROOT / 'assets/logo.webp').read_bytes()).decode()
css = css.replace('./PretendardVariable.woff2', 'data:font/woff2;base64,' + font)
html = html.replace('<link rel="stylesheet" href="assets/original.css">', '<style id="original-styles">' + css + '</style>')
html = html.replace('<link rel="stylesheet" href="mockup.css">', '<style id="mockup-styles">' + (ROOT / 'mockup.css').read_text(encoding='utf-8') + '</style>')
html = html.replace('assets/logo.webp', 'data:image/webp;base64,' + logo)
html = html.replace('<script src="mockup.js"></script>', '<script id="mockup-runtime">' + (ROOT / 'mockup.js').read_text(encoding='utf-8') + '</script>')
out = ROOT / 'careit-mockup.html'
out.write_text(html, encoding='utf-8')
print(f'Built {out.name} ({out.stat().st_size:,} bytes)')
