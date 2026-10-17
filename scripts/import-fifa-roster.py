"""Extract factual player fields from the official 2022 FIFA squad list.
Usage: python scripts/import-fifa-roster.py tmp/pdfs/fifa-2022-squads.pdf
No photographs, ratings, citizenship assumptions or preferred feet are imported.
"""
import sys, json, re, hashlib
from pathlib import Path
from datetime import datetime
import pdfplumber

pdf_path = Path(sys.argv[1])
source = 'https://fdp.fifa.org/assetspublic/ce44/pdf/SquadLists-English.pdf'
records = []
with pdfplumber.open(pdf_path) as pdf:
    for page_number, page in enumerate(pdf.pages, 1):
        chars = page.chars
        def text(x0,x1,y0,y1):
            selected = [c for c in chars if x0 <= (c['x0']+c['x1'])/2 < x1 and y0 <= (c['top']+c['bottom'])/2 < y1]
            selected.sort(key=lambda c:(round(c['top'],0),c['x0']))
            return ''.join(c['text'] for c in selected).replace('\x00','fi').strip()
        words=page.extract_words()
        country_word=next(w for w in words if re.fullmatch(r'\([A-Z]{3}\)',w['text']) and w['top']<55)
        nation = text(100,330,country_word['top']-1,country_word['top']+6)
        match = re.fullmatch(r'(.+) \(([A-Z]{3})\)', nation)
        assert match, (page_number, nation)
        nation_name, code = match.groups()
        header=next(w['top'] for w in words if w['text']=='POS' and w['top']<65)
        edges=sorted(set(e['x0'] for e in page.edges if abs(e['x0']-e['x1'])<0.01 and e['top']<header<e['bottom'] and 20<e['x0']<410))
        boundaries=[0]
        for edge in edges:
            if edge-boundaries[-1]>1:boundaries.append(edge)
        boundaries.append(page.width)
        assert len(boundaries)==12,(page_number,boundaries)
        positions = [w for w in words if w['text'] in ['GK','DF','MF','FW'] and 24<w['x0']<35 and header<w['top']<header+140]
        for pos in positions:
            y=pos['top']
            cell=lambda i: text(boundaries[i],boundaries[i+1],y-0.5,y+4)
            shirt_number=cell(0)
            dob=cell(6)
            if not re.fullmatch(r'\d{2}/\d{2}/\d{4}',dob):
                raise ValueError((page_number,shirt_number,dob))
            first,last=cell(3),cell(4)
            full=' '.join(v for v in [first,last] if v and v != '-')
            known=cell(2)
            # FIFA's display is family-first. First+last columns preserve the full name.
            shirt=cell(5)
            height=cell(8)
            records.append(dict(id=f'WC22-{code}-{int(shirt_number):02}',name=known,fullName=full,shirtName=shirt,
                country=nation_name,countryCode=code,birthDate=datetime.strptime(dob,'%d/%m/%Y').strftime('%Y-%m-%d'),
                club=cell(7),heightCm=int(height) if height.isdigit() else None,
                position={'GK':'GOL','DF':'DEF','MF':'MEI','FW':'ATA'}[pos['text']],sourceCaps=int(cell(9)),sourceGoals=int(cell(10)),referenceYear=2022,source=source,sourcePage=page_number))
assert len(records)>=800, len(records)
assert len({r['id'] for r in records})==len(records)
assert all(r['fullName'] and r['club'] and not re.search(r'[\x00-\x08\ufffd]',r['fullName']+r['club']) for r in records)
destination=Path('packages/game/data')
destination.mkdir(parents=True,exist_ok=True)
(destination/'fifa-2022.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
(destination/'fifa-2022-manifest.json').write_text(json.dumps(dict(source=source,referenceYear=2022,records=len(records),sha256=hashlib.sha256(pdf_path.read_bytes()).hexdigest(),extraction='PDF character coordinates; first/last names, DOB, club, height, broad position; no media',attribution='FIFA World Cup Qatar 2022 Squad List, 18 December 2022, version 1. Factual fields extracted for local development.'),indent=2)+'\n',encoding='utf8')
print(json.dumps({'records':len(records),'countries':len({r['countryCode'] for r in records}),'clubs':len({r['club'] for r in records}),'sample':records[:2]},ensure_ascii=True))
