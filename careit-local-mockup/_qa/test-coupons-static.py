from html.parser import HTMLParser
from pathlib import Path

class Collector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags=[]
        self.text=[]
    def handle_starttag(self, tag, attrs):
        self.tags.append((tag,dict(attrs)))
    def handle_data(self, value):
        self.text.append(value)

root=Path(__file__).resolve().parents[1]
p=Collector()
p.feed((root/'index.html').read_text(encoding='utf-8'))
links=[a for t,a in p.tags if t=='a' and a.get('href')=='#/coupons']
assert len(links)==2 and any(link.get('aria-label')=='쿠폰함' for link in links)
assert any(t=='template' and a.get('data-path')=='/coupons' for t,a in p.tags)
tabs=[a for t,a in p.tags if t=='button' and a.get('data-action')=='coupon-tab']
assert {a['data-tab'] for a in tabs}=={'available','history'}
assert next(a for a in tabs if a['data-tab']=='available')['aria-pressed']=='true'
panels=[a for _,a in p.tags if 'data-coupon-panel' in a]
assert {a['data-coupon-panel'] for a in panels}=={'available','history'}
assert 'hidden' in next(a for a in panels if a['data-coupon-panel']=='history')
assert '초대 쿠폰 예시' not in ''.join(p.text)
assert '사용 완료' in ''.join(p.text) and '기간 만료' in ''.join(p.text)
coupon_buttons=[a for t,a in p.tags if t=='button' and a.get('data-action')=='coupon-preview']
assert len(coupon_buttons)==4
assert [a['data-coupon'] for a in coupon_buttons]==['초대한 분 보상 · 플러스 7일 이용권','초대한 분 보상 · 플러스 7일 이용권','초대한 분 보상 · 플러스 14일 이용권','초대받은 분 보상 · 플러스 7일 이용권']
assert any(t=='template' and a.get('data-path')=='/notifications' for t,a in p.tags)
runtime=(root/'mockup.js').read_text(encoding='utf-8')
assert "'/coupons':'쿠폰함'" in runtime and "action==='coupon-tab'" in runtime
print('Coupon navigation, example, tab panels and existing notification link passed.')
