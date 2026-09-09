from zipfile import ZipFile
from xml.etree import ElementTree as E
from pathlib import Path
import json
source=Path('../乡村适老化建设辅助工作台_调试工作区方案说明_V1.0.docx')
with ZipFile(source) as z: root=E.fromstring(z.read('word/document.xml'))
ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
paragraphs=[''.join(t.text or '' for t in p.findall('.//w:t',ns)) for p in root.findall('.//w:p',ns)]
Path('work').mkdir(exist_ok=True)
Path('work/plan-docx-paragraphs.json').write_text(json.dumps(paragraphs,ensure_ascii=False))
print(f'提取 {len(paragraphs)} 段；保留段落编号。')
