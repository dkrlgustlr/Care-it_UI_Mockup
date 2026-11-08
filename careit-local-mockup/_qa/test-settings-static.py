from html.parser import HTMLParser
from pathlib import Path

class SettingsParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags = []
        self.text = []
    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))
    def handle_data(self, data):
        self.text.append(data)

root = Path(__file__).resolve().parents[1]
parser = SettingsParser()
parser.feed((root / 'index.html').read_text(encoding='utf-8'))
tags = parser.tags
links = [a for tag, a in tags if tag == 'a' and a.get('href') == 'https://cafe.naver.com/careitofficial']
assert len(links) >= 1 and any(a.get('aria-label', '').startswith('케어릿 공식 카페') and a.get('target') == '_blank' and 'noopener' in a.get('rel','') for a in links)
sessions = [a['data-session-id'] for tag, a in tags if tag == 'li' and 'data-session-id' in a]
assert len(sessions) == len(set(sessions)) == 5 and sessions[0] == 'windows-current'
session_details = [a for tag, a in tags if tag == 'details' and a.get('class') == 'session-details']
assert len(session_details) == 1 and 'open' not in session_details[0]
assert len([a for tag, a in tags if tag == 'details' and a.get('class') == 'settings-consent-details']) == 2
assert any('data-ai-consent-status' in a for _, a in tags)
assert any('data-marketing-status' in a for _, a in tags)
assert any(a.get('data-action') == 'theme' and a.get('data-tooltip') == '다크 모드로 변경' for _, a in tags)
assert any(a.get('href') == '#/coupons' and a.get('data-tooltip') == '쿠폰함' for _, a in tags)
assert any(a.get('data-action') == 'copy-account-invite' for _, a in tags)
assert any(a.get('id') == 'account-invite-url' and 'readonly' in a for _, a in tags)
assert any(a.get('data-path') == '/invite' for _, a in tags)
assert any(a.get('href') == 'https://cafe.naver.com/careitofficial' and a.get('data-tooltip') == '케어릿 공식 카페' for _, a in tags)
assert any(a.get('class') == 'avatar' and a.get('aria-hidden') == 'true' for _, a in tags)
for route in ('#/notices',):
    assert any(tag == 'a' and a.get('href') == route for tag, a in tags)
for statement in ('동의를 거부할 권리가 있으며', '구글의 AI 서비스로 전송돼요', '계정 탈퇴'):
    assert statement in ' '.join(parser.text)
print('Settings structure, consent details, session identifiers and cafe link passed.')
