import base64, io, json, re, sys, zipfile
from xml.etree import ElementTree as ET

def extract(payload):
    data = base64.b64decode(payload['data'], validate=True)
    if len(data) > 4_000_000:
        raise ValueError('파일은 4MB 이하여야 해요.')
    name = payload['name'].lower()
    if name.endswith('.txt'):
        text = data.decode('utf-8-sig')
    elif name.endswith('.pdf'):
        from pypdf import PdfReader
        pdf = PdfReader(io.BytesIO(data))
        if pdf.is_encrypted or len(pdf.pages) > 100:
            raise ValueError('암호화되었거나 100쪽을 초과한 PDF는 읽을 수 없어요.')
        pages = [page.extract_text() or '' for page in pdf.pages]
        if any(not page.strip() for page in pages):
            raise ValueError('텍스트를 읽지 못한 PDF 페이지가 있어요. 스캔 페이지는 문자 인식이 필요해요.')
        text = '\n'.join(pages)
    elif name.endswith(('.docx', '.hwpx')):
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            files = [i for i in archive.infolist() if (i.filename == 'word/document.xml' if name.endswith('.docx') else re.fullmatch(r'Contents/section\d+\.xml', i.filename, re.I))]
            if not files or sum(i.file_size for i in files) > 10_000_000:
                raise ValueError('문서 본문을 읽을 수 없어요.')
            parts = []
            for item in sorted(files, key=lambda v:v.filename):
                root = ET.fromstring(archive.read(item))
                paragraphs = [n for n in root.iter() if n.tag.rsplit('}', 1)[-1] == 'p']
                for p in paragraphs:
                    line = ''.join(n.text or '' for n in p.iter() if n.tag.rsplit('}', 1)[-1] == 't')
                    if line: parts.append(line)
            text = '\n'.join(parts)
    elif name.endswith('.hwp'):
        raise ValueError('HWP 파일은 아직 읽을 수 없어요. HWPX 또는 PDF로 저장해 주세요.')
    else:
        raise ValueError('지원하지 않는 파일 형식이에요.')
    text = text.strip()
    if not text:
        raise ValueError('읽을 수 있는 텍스트가 없어요. 스캔 문서는 아직 읽지 못해요.')
    if len(text.encode('utf-8')) > 600000:
        raise ValueError('파일의 텍스트가 너무 길어 한 번에 처리할 수 없어요.')
    return {'text':text, 'truncated':False}

try:
    print(json.dumps(extract(json.load(sys.stdin))))
except Exception as error:
    print(json.dumps({'error':str(error)}))
