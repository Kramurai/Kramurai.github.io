"""Build the versioned, fillable Kramurai battery return template. No network."""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
from reportlab.lib.utils import simpleSplit
import io
import fitz
from pypdf import PdfReader, PdfWriter, Transformation

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'assets/entsorgungsnachweis-starterbatterie-v1.5.pdf'
W, H = 595.276, 841.89
INK, GREEN, LINE = HexColor('#18372f'), HexColor('#18554d'), HexColor('#a5b9ac')
COPY = '© 2026 Kramurai · Vorlagengestaltung · kramurai.github.io · Stand 19.10.2026'

def build(output=OUTPUT):
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=(W,H))
    c.setTitle('Rückgabenachweis für Starterbatterien - Kramurai v1.5')
    c.setAuthor('Kramurai')
    def text(x,y,s,size=10,bold=False):
        c.setFillColor(INK);c.setFont('Helvetica-Bold' if bold else 'Helvetica',size);c.drawString(x,y,s)
    def para(x,y,s,width=525,size=10,leading=14):
        for line in simpleSplit(s,'Helvetica',size,width):
            text(x,y,line,size);y-=leading
        return y
    def header(title,sub):
        c.setFillColor(GREEN);c.roundRect(28,H-103,W-56,75,8,fill=1,stroke=0)
        c.setFillColor(white);c.setFont('Helvetica',8);c.drawString(88,H-87,'Einfach. Nützlich. Kostenlos.')
        c.setFillColor(white);c.setFont('Helvetica',9);c.drawRightString(W-42,H-56,'Kostenlose private Vorlage')
        c.drawRightString(W-42,H-72,'Version 1.5 | 19.10.2026')
        text(28,H-128,title,18,True);return para(28,H-148,sub,size=9.5)
    def footer(n):
        text(28,22,COPY,7.4);c.setFont('Helvetica',8);c.drawRightString(W-28,22,f'Seite {n} von 2')
    def section(y,title):
        c.setFillColor(HexColor('#edf3ed'));c.roundRect(28,y-6,W-56,24,4,fill=1,stroke=0)
        text(38,y+2,title,11,True);return y-33
    def field(name,label,x,y,width,value='',height=25,multiline=False):
        text(x,y+height+5,label,9,True)
        c.acroForm.textfield(name=name,tooltip=label,x=x,y=y,width=width,height=height,
          value=value,fontName='Helvetica',fontSize=10,borderWidth=.7,borderColor=LINE,
          fillColor=white,textColor=INK,forceBorder=True,fieldFlags='multiline' if multiline else '',maxlen=1800 if multiline else 250)
    y=header('Rückgabenachweis für Starterbatterien',
      'Zur Bestätigung einer Rücknahme ohne Pfanderstattung durch die Annahmestelle.')
    y=para(28,y-8,'Vorbereiten, ausdrucken und erst nach der tatsächlichen Rücknahme bestätigen lassen. '
      'Diese Vorlage allein ist noch kein bestätigter Rückgabenachweis.',size=9.5)
    y=section(y-28,'Angaben zur Rückgabe')
    field('name','Name / Vorname',28,y-25,332);field('date','Datum der tatsächlichen Rückgabe',376,y-25,191)
    y-=65;field('street','Straße / Hausnummer (falls zur Zuordnung benötigt)',28,y-25,260);field('city','PLZ / Ort (falls benötigt)',304,y-25,263)
    y-=65;field('collection_site','Annahmestelle / Anschrift oder eindeutige Bezeichnung',28,y-25,404);field('quantity','Anzahl Batterien',448,y-25,119)
    y-=65;field('battery_type','Batterietyp / Beschreibung',28,y-25,332,'Gebrauchte Fahrzeug-Starterbatterie');field('capacity','Kapazität / Zusatzangabe (optional)',376,y-25,191)
    y-=79;field('notes','Bemerkungen / Zuordnung (optional)',28,y-35,539,height=35,multiline=True)
    y-=73;y=section(y,'Bestätigung - ausschließlich durch die Annahmestelle')
    y=para(28,y+3,'Wir bestätigen, dass die oben bezeichnete(n) Starteraltbatterie(n) am angegebenen '
      'Rückgabedatum von uns zurückgenommen wurde(n), ohne hierfür Batteriepfand zu erstatten.',size=10)
    field('place_date','Ort / Datum der Ausstellung',28,y-60,250)
    c.setStrokeColor(LINE);c.roundRect(298,y-60,269,48,3,fill=0,stroke=1)
    text(308,y-24,'Name / Stempel und Unterschrift',9,True);text(308,y-40,'der Annahmestelle',9)
    para(28,y-83,'Private Vorlage, kein amtliches Formular. Die Annahmestelle bestätigt die Rücknahme, '
      'nicht eine bereits abgeschlossene Verwertung. Hinweise zur Pfanderstattung: Seite 2.',size=8.5,leading=11)
    footer(1);c.showPage()
    y=header('Kurzanleitung: Rückgabe und Batteriepfand','Zur Verwendung des Rückgabenachweises auf Seite 1.')
    sections=[
      ('1. Rückgabe und Pfand unterscheiden',
       'Das Pfand beträgt nach § 19 Abs. 1 BattDG 7,50 Euro je separat verkaufter Starterbatterie, '
       'wenn beim Kauf keine Starteraltbatterie zurückgegeben wird. Bei Rückgabe an den Händler, '
       'der das Pfand erhoben hat, erfolgt die Erstattung dort. Eine ausgegebene Pfandmarke kann benötigt werden.'),
      ('2. Rückgabe bei einer anderen geeigneten Annahmestelle',
       'Erfassungsberechtigte Annahmestellen sind insbesondere Händler nach § 18 BattDG, beteiligte '
       'öffentlich-rechtliche Entsorgungsträger und ausgewählte Abfallbewirtschafter (§ 6 Abs. 3 BattDG). '
       'Die Annahme vorab klären. Auf Verlangen ist die Rücknahme ohne Pfanderstattung schriftlich '
       'oder elektronisch zu bestätigen (§ 19 Abs. 2 BattDG).'),
      ('3. Nachweis rechtzeitig beim Onlinehändler vorlegen',
       'Bei einem Fernabsatzhändler kann die Pfanderstattung auch mit einem solchen schriftlichen '
       'oder elektronischen Rückgabenachweis erfolgen. Der Nachweis darf bei der Vorlage nicht älter '
       'als zwei Wochen sein. Zeitnah einreichen und Zuordnungsangaben wie Bestellung oder Rechnung '
       'mitteilen. Das Erstellungsdatum dieser Vorlage ersetzt nicht das Ausstellungsdatum des Nachweises.'),
      ('4. Bestätigen lassen und aufbewahren',
       'Vorlage mitnehmen und die tatsächliche Rücknahme ohne Pfanderstattung von der Annahmestelle '
       'bestätigen lassen. Name, Rückgabedatum, Anzahl, Beschreibung und eine eindeutige Annahmestelle '
       'machen den Nachweis nachvollziehbar. Name/Stempel und Unterschrift sind für diese Papiervorlage '
       'vorgesehen; das Gesetz lässt auch einen elektronischen Nachweis zu. Foto oder Scan und '
       'Einreichungsbeleg bis zur Erstattung aufbewahren. Pfand nicht doppelt beanspruchen.'),
      ('Hinweise und Weitergabe',
       'Kein amtliches Formular und keine individuelle Rechtsberatung. Angaben zur Rücknahme dürfen '
       'erst nach der tatsächlichen Annahme bestätigt werden. Nicht für Antriebs- oder andere '
       'Batteriekategorien verwenden. Diese kostenlose private Vorlage darf unverändert weitergegeben '
       'werden. Bearbeitete Fassungen als angepasst kennzeichnen. Rechte an eingetragenen Inhalten '
       'oder beigefügten Fotos werden nicht beansprucht.')]
    for title,body in sections:
        y=section(y-25,title);y=para(28,y+7,body,size=10,leading=14)
    y-=21;text(28,y,'Rechtsgrundlagen (geprüft am 19.10.2026): §§ 6, 18 und 19 BattDG',9,True)
    for endpoint in ['__6','__18','__19']:
        y-=14;url=f'https://www.gesetze-im-internet.de/battdg/{endpoint}.html';text(28,y,url,8);c.linkURL(url,(28,y-2,440,y+10),relative=0)
    assert y>45,'Guide overflows'
    footer(2);c.save()
    writer=PdfWriter();writer.clone_document_from_reader(PdfReader(buffer))
    with fitz.open(stream=(ROOT/'assets/brand/kramurai-logo-header.svg').read_bytes(),filetype='svg') as svg:
        logo=PdfReader(io.BytesIO(svg.convert_to_pdf())).pages[0]
    scale=190/float(logo.mediabox.width)
    for page in writer.pages:
        page.merge_transformed_page(logo,Transformation().scale(scale).translate(42,H-78))
    with open(output,'wb') as stream:writer.write(stream)
    return output

if __name__=='__main__':
    print(build())
