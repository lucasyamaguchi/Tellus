from pathlib import Path
import re

src = Path('guia-estudo-arquitetura-de-software.md').read_text(encoding='utf-8')
lines=[]
for raw in src.splitlines():
    s=raw.strip()
    if not s:
        lines.append(('space',''))
    elif s.startswith('# '):
        lines.append(('title', re.sub(r'[*_`]','',s[2:])))
    elif s.startswith('## '):
        lines.append(('h2', re.sub(r'[*_`]','',s[3:])))
    elif s.startswith('### '):
        lines.append(('h3', re.sub(r'[*_`]','',s[4:])))
    elif s.startswith('- '):
        lines.append(('bullet', re.sub(r'[*_`]','',s[2:])))
    elif s.startswith('> '):
        lines.append(('quote', re.sub(r'[*_`]','',s[2:])))
    elif re.match(r'^\d+\. ',s):
        lines.append(('number', re.sub(r'[*_`]','',s)))
    elif s.startswith('**Fundamentos essenciais:**'):
        lines.append(('bold', re.sub(r'[*_`]','',s)))
    else:
        lines.append(('text', re.sub(r'[*_`]','',s)))

# Wrap lines for A4-ish printable area
pages=[]; page=[]; y=800
for kind,text in lines:
    size={'title':22,'h2':16,'h3':12,'text':10,'bullet':10,'number':10,'quote':10,'bold':10,'space':5}[kind]
    leading={'title':30,'h2':23,'h3':18,'text':14,'bullet':14,'number':14,'quote':14,'bold':14,'space':7}[kind]
    indent=0
    if kind=='bullet': text='• '+text; indent=12
    if kind=='quote': text='▌ '+text; indent=12
    maxchars=92 if kind not in ('title','h2','h3') else 78
    words=text.split(); chunks=[]; cur=''
    for w in words:
        if len(cur)+len(w)+1<=maxchars: cur=(cur+' '+w).strip()
        else: chunks.append(cur); cur=w
    if cur or not text: chunks.append(cur)
    for chunk in chunks:
        if y-leading < 45:
            pages.append(page); page=[]; y=800
        page.append((kind,chunk,y,indent)); y-=leading
    if kind in ('h2','h3'): y-=4
if page: pages.append(page)

objects=[]
def obj(x): objects.append(x); return len(objects)
font=obj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
fontb=obj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>')
page_ids=[]
for pnum,page in enumerate(pages,1):
    content=['BT']
    for kind,text,y,indent in page:
        if kind in ('title','h2','h3','bold'): content.append(f'/F{2 if kind in ("title","h2","h3","bold") else 1} { {"title":22,"h2":16,"h3":12,"bold":10}.get(kind,10)} Tf')
        else: content.append('/F1 10 Tf')
        if kind=='title': color='0.09 0.21 0.36 rg'
        elif kind in ('h2','h3'): color='0.12 0.31 0.48 rg'
        elif kind=='quote': color='0.25 0.25 0.25 rg'
        else: color='0.12 0.12 0.12 rg'
        content.append(color)
        safe=text.replace('\\','\\\\').replace('(','\\(').replace(')','\\)')
        content.append(f'1 0 0 1 {54+indent} {y} Tm ({safe}) Tj')
    content.append('ET')
    stream='\n'.join(content).encode('latin-1','replace')
    sid=obj(f'<< /Length {len(stream)} >>\nstream\n{stream.decode("latin-1")}\nendstream')
    pid=obj(f'<< /Type /Page /Parent PAGES /MediaBox [0 0 595 842] /Resources << /Font << /F1 {font}  /F2 {fontb} >> >> /Contents {sid} 0 R >>')
    page_ids.append(pid)
# patch pages parent
pages_obj_num=len(objects)+1
for i in page_ids:
    objects[i-1]=objects[i-1].replace('PAGES',f'{pages_obj_num} 0 R')
page_obj=obj(f'<< /Type /Pages /Kids [{" ".join(str(i)+" 0 R" for i in page_ids)}] /Count {len(page_ids)} >>')
catalog=obj(f'<< /Type /Catalog /Pages {page_obj} 0 R >>')

out=bytearray(b'%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'); offsets=[0]
for i,o in enumerate(objects,1):
    offsets.append(len(out)); out += f'{i} 0 obj\n{o}\nendobj\n'.encode('latin-1','replace')
xref=len(out); out += f'xref\n0 {len(objects)+1}\n0000000000 65535 f \n'.encode()
for off in offsets[1:]: out += f'{off:010d} 00000 n \n'.encode()
out += f'trailer\n<< /Size {len(objects)+1} /Root {catalog} 0 R >>\nstartxref\n{xref}\n%%EOF'.encode()
Path('guia-estudo-arquitetura-de-software.pdf').write_bytes(out)
print(f'PDF criado: {len(pages)} páginas, {len(out)} bytes')
