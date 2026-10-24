# 提取 docx 全部文本结构（段落 + 表格），输出到 txt 供解析
import sys
from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph

def iter_block_items(parent):
    from docx.oxml.ns import qn
    for child in parent.element.body.iterchildren():
        if child.tag == qn('w:p'):
            yield Paragraph(child, parent)
        elif child.tag == qn('w:tbl'):
            yield Table(child, parent)

path = sys.argv[1]
out = sys.argv[2]
doc = Document(path)
lines = []
for block in iter_block_items(doc):
    if isinstance(block, Paragraph):
        t = block.text.strip()
        if t:
            lines.append(t)
    else:
        lines.append('===TABLE===')
        for row in block.rows:
            cells = [c.text.strip().replace('\n', ' ') for c in row.cells]
            lines.append(' | '.join(cells))
        lines.append('===ENDTABLE===')
with open(out, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))
print('lines:', len(lines))
