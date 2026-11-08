"""외부 패키지 없이 전달용 단일 HTML을 생성합니다: python build.py"""
from pathlib import Path
import base64
from html import escape

ROOT = Path(__file__).resolve().parent
html = (ROOT / 'index.html').read_text(encoding='utf-8')
for key, label in {'privacy': '개인정보처리방침', 'terms': '이용약관'}.items():
    marker = f'<article class="policy-article" data-policy-content="{key}"><a href="https://app.careit.kr/{key}">{label} 전문 보기</a></article>'
    assert marker in html, f'Missing policy placeholder: {key}'
    content = (ROOT / 'assets' / f'careit-{key}.html').read_text(encoding='utf-8')
    html = html.replace(marker, f'<article class="policy-article" data-policy-content="{key}">{content}</article>')
for key, filename in {'material':'MATERIAL-SYMBOLS-LICENSE.txt','pretendard':'Pretendard-OFL.txt','wanted':'WantedSans-OFL.txt','lucide':'LUCIDE-LICENSE.txt'}.items():
    marker = f'<pre data-license-text="{key}"><a href="assets/{filename}">라이선스 전문 파일 보기</a></pre>'
    assert marker in html, f'Missing license placeholder: {key}'
    text = (ROOT / 'assets' / filename).read_text(encoding='utf-8')
    html = html.replace(marker, f'<pre data-license-text="{key}" tabindex="0">{escape(text)}</pre>')
lucide_license = (ROOT / 'assets/LUCIDE-LICENSE.txt').read_text(encoding='utf-8')
html = html.replace('<head>', '<head>\n<!-- Third-party icons: Lucide pencil, mail and message-circle-more, https://lucide.dev/icons/\n' + lucide_license + '\n-->')
css = (ROOT / 'assets/original.css').read_text(encoding='utf-8')
font = base64.b64encode((ROOT / 'assets/PretendardVariable.woff2').read_bytes()).decode()
logo = base64.b64encode((ROOT / 'assets/logo.webp').read_bytes()).decode()
css = css.replace('./PretendardVariable.woff2', 'data:font/woff2;base64,' + font)
html = html.replace('<link rel="stylesheet" href="assets/original.css">', '<style id="original-styles">' + css + '</style>')
wanted_font = base64.b64encode((ROOT / 'assets/WantedSansVariable.woff2').read_bytes()).decode()
mockup_css = (ROOT / 'mockup.css').read_text(encoding='utf-8').replace('assets/WantedSansVariable.woff2', 'data:font/woff2;base64,' + wanted_font)
html = html.replace('<link rel="stylesheet" href="mockup.css">', '<style id="mockup-styles">' + mockup_css + '</style>')
live_css = (ROOT / 'assets/live.css').read_text(encoding='utf-8').replace('./PretendardVariable.woff2', 'data:font/woff2;base64,' + font)
html = html.replace('<link rel="stylesheet" href="assets/live.css">', '<style id="live-styles">' + live_css + '</style>')
html = html.replace('<link rel="stylesheet" href="iep.css">', '<style id="iep-styles">' + (ROOT / 'iep.css').read_text(encoding='utf-8') + '</style>')
html = html.replace('<link rel="stylesheet" href="quick-check.css">', '<style id="quick-check-styles">' + (ROOT / 'quick-check.css').read_text(encoding='utf-8') + '</style>')
html = html.replace('assets/logo.webp', 'data:image/webp;base64,' + logo)
for asset in ('careit-home-banner-muted.png', 'careit-home-banner-muted-mobile.png'):
    encoded = base64.b64encode((ROOT / 'assets' / asset).read_bytes()).decode()
    html = html.replace('assets/' + asset, 'data:image/png;base64,' + encoded)
html = html.replace('<script src="mockup.js"></script>', '<script id="mockup-runtime">' + (ROOT / 'mockup.js').read_text(encoding='utf-8') + '</script>')
for i in range(1, 13):
    asset = f'assets/profile-avatars/avatar-{i:02}.png'
    html = html.replace(asset, 'data:image/png;base64,' + base64.b64encode((ROOT / asset).read_bytes()).decode())
html = html.replace('<script src="iep.js"></script>', '<script id="iep-runtime">' + (ROOT / 'iep.js').read_text(encoding='utf-8') + '</script>')
html = html.replace('<script src="observation-templates.js"></script>', '<script id="observation-templates">' + (ROOT / 'observation-templates.js').read_text(encoding='utf-8') + '</script>')
html = html.replace('<script src="live-scoring.js"></script>', '<script id="live-scoring">' + (ROOT / 'live-scoring.js').read_text(encoding='utf-8') + '</script>')
out = ROOT / 'careit-mockup.html'
out.write_text(html, encoding='utf-8')
print(f'Built {out.name} ({out.stat().st_size:,} bytes)')
