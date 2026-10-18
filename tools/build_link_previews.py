#!/usr/bin/env python3
"""Build branded Open Graph JPEGs from existing approved site assets.

Requires Inkscape and Pillow. Run from any working directory.
"""
import base64
import html
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageFont

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'assets' / 'social'
CARDS = [
    ('startseite', '', 'KOSTENLOSE ALLTAGSHELFER',
     ['Kostenlose Formulare.', 'Praktische Helfer.'],
     ['Festhalten, was später', 'wichtig sein kann.'],
     'assets/brand/kramurai-raven-light-background.svg',
     'Kramurai: Kostenlose Formulare und praktische Helfer. Daneben das Kramurai-Rabenlogo.'),
    ('retoure', 'retoure-dokumentieren/', 'RETOURE DOKUMENTIEREN',
     ['Zurückschicken.', 'Vorher festhalten.'],
     ['Fotos und Versanddaten', 'als eigene PDF sammeln.'],
     'retoure-dokumentieren/retoure-ergebnis.png',
     'Kramurai zur Retouren-Dokumentation mit Beispiel-PDF: ein illustratives Paket sowie Zustands- und Versandangaben.'),
    ('router', 'router-zurueckgeben/', 'ROUTER ZURÜCKGEBEN',
     ['Gerät und Zubehör.', 'Versand festhalten.'],
     ['Die Rückgabe dokumentieren.', 'Mit Fotos und eigener PDF.'],
     'router-zurueckgeben/ergebnis.png',
     'Kramurai zur Router-Rückgabe mit Beispiel-PDF: illustrativer Router, Netzteil und Kabel sowie Dokumentationsfelder.'),
    ('handy', 'handy-trade-in-dokumentieren/', 'HANDY ANS ANKAUFPORTAL',
     ['Vor dem Versand:', 'Zustand festhalten.'],
     ['Angaben, Fotos und Versand', 'als eigene PDF dokumentieren.'],
     'handy-trade-in-dokumentieren/ergebnis.png',
     'Kramurai zur Handy-Dokumentation mit Beispiel-PDF: illustratives Handy und Kabel sowie Zustands- und Versandangaben.'),
    ('autoverkauf', 'autoverkauf-dokumentieren/', 'PRIVATER AUTOVERKAUF',
     ['Zahlung und Übergabe', 'getrennt festhalten.'],
     ['Deine Dokumentation als PDF.', 'Ergänzung zum Kaufvertrag.'],
     'autoverkauf-dokumentieren/ergebnis.png',
     'Kramurai zum privaten Autoverkauf mit Beispiel-PDF: illustratives Auto sowie getrennte Angaben zu Zahlung und Übergabe.'),
    ('starterbatterie', 'entsorgungsnachweis-starterbatterie/', 'STARTERBATTERIE ABGEBEN',
     ['Entsorgungsnachweis', 'als PDF-Vorlage.'],
     ['Kostenlose Vorlage', 'zum Ausfüllen und Ausdrucken.'],
     'entsorgungsnachweis-starterbatterie/formularvorschau.png',
     'Kramurai: Entsorgungsnachweis für Starterbatterien als kostenlose PDF-Vorlage, daneben die Formularvorschau.'),
]


def data_url(path):
    mime = 'image/svg+xml' if path.suffix == '.svg' else 'image/png'
    return 'data:' + mime + ';base64,' + base64.b64encode(path.read_bytes()).decode()


def text_line(text, x, y, size, weight='normal', color='#173F39'):
    font = ImageFont.truetype('DejaVuSans-Bold.ttf' if weight == 'bold' else 'DejaVuSans.ttf', size)
    assert font.getlength(text) <= 588, f'Text exceeds left column: {text}'
    return f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{weight}" fill="{color}">{html.escape(text)}</text>'


def build():
    DEST.mkdir(parents=True, exist_ok=True)
    logo = data_url(ROOT / 'assets/brand/kramurai-logo-claim-light-background.svg')
    with tempfile.TemporaryDirectory(prefix='kramurai-social-') as tmp:
        for key, _, label, heading, copy, image, _ in CARDS:
            right = data_url(ROOT / image)
            label_svg = text_line(label, 56, 215, 22, 'bold', '#245E55')
            title_svg = ''.join(text_line(line, 56, 285 + i * 58, 43, 'bold') for i, line in enumerate(heading))
            copy_svg = ''.join(text_line(line, 56, 409 + i * 35, 26) for i, line in enumerate(copy))
            badge = 'PDF-Vorlage' if key == 'starterbatterie' else 'PDF-Beispiel · Beispieldaten'
            if key == 'startseite':
                picture = f'<image x="730" y="135" width="370" height="380" xlink:href="{right}"/>'
            elif key == 'starterbatterie':
                picture = f'<image x="802" y="160" width="249" height="352" xlink:href="{right}"/>'
            else:
                picture = f'<image x="690" y="180" width="454" height="366" xlink:href="{right}"/>'
            note = '' if key == 'startseite' else f'<text x="917" y="145" text-anchor="middle" font-size="19" fill="#245E55">{badge}</text>'
            svg = f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#F4F1E8"/>
<rect x="665" y="105" width="507" height="462" rx="28" fill="#DFE8DC"/>
<image x="56" y="36" width="515" height="118" xlink:href="{logo}"/>
<g font-family="DejaVu Sans, sans-serif">{label_svg}{title_svg}{copy_svg}{note}{picture}
<rect x="56" y="489" width="575" height="57" rx="13" fill="#173F39"/>
<text x="343" y="526" text-anchor="middle" font-size="26" font-weight="bold" fill="#FFFFFF">Kostenlos · Ohne Anmeldung</text>
<text x="56" y="594" font-size="25" font-weight="bold" fill="#245E55">kramurai.github.io</text>
</g><rect y="620" width="1200" height="10" fill="#B4432D"/></svg>'''
            source, raster = Path(tmp) / f'{key}.svg', Path(tmp) / f'{key}.png'
            source.write_text(svg)
            subprocess.run(['inkscape', str(source), '--export-type=png', '--export-filename=' + str(raster)], check=True, capture_output=True)
            with Image.open(raster) as im:
                im.convert('RGB').save(DEST / f'{key}-20261018.jpg', quality=90, optimize=True, progressive=True, subsampling=0)
            print(f'{key}: {(DEST / (key + "-20261018.jpg")).stat().st_size} bytes')


if __name__ == '__main__':
    build()
