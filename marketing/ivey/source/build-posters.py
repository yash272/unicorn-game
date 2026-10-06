"""Editable, vector A4 poster sources. Run from anywhere with ReportLab + Pillow.

All QR codes are ordinary ISO QR symbols with a four-module white quiet zone.
The only illustration is the existing Rockstar CTO card, drawn by the deck's
own renderer. No generated art, altered card design, or raster text is used.
"""
import importlib.util
import json
from pathlib import Path
from PIL import Image
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'marketing/ivey'
spec = importlib.util.spec_from_file_location('deck', ROOT / 'scripts/export-pdfs.py')
deck = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deck)
W, H = A4
P = {'ink': '#202024', 'dark': '#0C0A10', 'paper': '#F5F0E6',
     'violet': '#AE91FF', 'lime': '#DDFA83', 'coral': '#FF806C',
     'white': '#FFFFFF', 'muted': '#AAA5B7'}
QR_SIZE = 280  # 98.8 mm on A4, 139.7 mm when enlarged to A3
QR_Y = 166
for folder in ['qr', 'posters']:
    (OUT / folder).mkdir(parents=True, exist_ok=True)


def box(c, x, y, w, h, color, radius=0):
    c.setFillColor(HexColor(P.get(color, color)))
    if radius:
        c.roundRect(x, y, w, h, radius, fill=1, stroke=0)
    else:
        c.rect(x, y, w, h, fill=1, stroke=0)


def txt(c, text, y, size, color='ink', font='Heavy', x=None, max_width=531):
    # Fit deliberately; never silently clip a headline at the page edge.
    width = pdfmetrics.stringWidth(text, font, size)
    assert width <= max_width, (text, width, max_width)
    c.setFillColor(HexColor(P.get(color, color)))
    c.setFont(font, size)
    if x is None:
        c.drawCentredString(W / 2, y, text)
    else:
        c.drawString(x, y, text)


def qr_matrix(url):
    symbol = QrCodeWidget(url, barLevel='M', barBorder=4)
    symbol.draw()
    data = symbol.qr.modules
    n = len(data) + 8
    return [[False] * n for _ in range(4)] + [
        [False] * 4 + row + [False] * 4 for row in data
    ] + [[False] * n for _ in range(4)]


def export_qr(matrix, variant):
    n = len(matrix)
    paths = ' '.join(f'M{x},{y}h1v1h-1z' for y, row in enumerate(matrix)
                     for x, black in enumerate(row) if black)
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {n} {n}" width="1184" height="1184"><rect width="{n}" height="{n}" fill="white"/><path d="{paths}" fill="#000"/></svg>\n'
    (OUT / 'qr' / f'ivey-{variant}.svg').write_text(svg)
    im = Image.new('RGB', (n, n), 'white')
    im.putdata([(0, 0, 0) if p else (255, 255, 255) for row in matrix for p in row])
    im.resize((n * 64, n * 64), Image.Resampling.NEAREST).save(
        OUT / 'qr' / f'ivey-{variant}.png', dpi=(300, 300))


def draw_qr(c, matrix):
    x0 = (W - QR_SIZE) / 2
    box(c, x0 - 8, QR_Y - 8, QR_SIZE + 16, QR_SIZE + 16, 'white', 8)
    unit = QR_SIZE / len(matrix)
    c.setFillColor(HexColor('#000000'))
    # Adjacent modules are merged into horizontal runs to avoid renderer seams.
    for y, row in enumerate(matrix):
        start = None
        for x, dark in enumerate(row + [False]):
            if dark and start is None:
                start = x
            if not dark and start is not None:
                c.rect(x0 + start * unit, QR_Y + (len(matrix) - y - 1) * unit,
                       (x - start) * unit, unit, fill=1, stroke=0)
                start = None


def identity(c, color='ink', meta=True):
    txt(c, 'UNICORN', 530, 43, color)
    txt(c, 'THE STARTUP CARD GAME', 504, 18, color, 'Display')
    if meta:
        txt(c, '3-5 PLAYERS  /  ~45 MINUTES' + ('  /  FIRST TO $1B WINS' if meta == 'full' else ''),
            479, 10.5, color, 'Bold')


def footer(c, cta, color, variant, letter):
    txt(c, cta, 126, 23, color)
    txt(c, 'unicornthegame.com', 101, 13.5, color, 'Bold')
    txt(c, 'COMING TO KICKSTARTER', 53, 10, color, 'Bold')
    txt(c, letter, 30, 7, color, 'Bold', x=W - 38, max_width=10)


def poster(variant, letter, name):
    path = OUT / 'posters' / f'UNICORN-Ivey-{letter}-{name}-A4.pdf'
    c = canvas.Canvas(str(path), pagesize=A4, pageCompression=1)
    c.setTitle(f'UNICORN | Ivey poster {letter}: {name}')
    c.setAuthor('UNICORN: The Startup Card Game')
    c.setSubject(f'A4 vector print artwork | https://www.unicornthegame.com/ivey-{variant}')
    if variant == 'build':
        box(c, 0, 0, W, H, 'paper')
        box(c, 32, 793, 45, 8, 'violet')
        txt(c, 'BUILD A', 750, 72)
        txt(c, 'BILLION-DOLLAR', 680, 72)
        txt(c, 'STARTUP.', 610, 72)
        # Secondary line belongs with the primary hook, not the QR instructions.
        txt(c, 'BETRAY YOUR FRIENDS ALONG THE WAY.', 579, 15, 'ink', 'Display')
        identity(c, meta='full')
        footer(c, 'SCAN TO BUILD YOUR UNICORN', 'ink', variant, letter)
    elif variant == 'cto':
        box(c, 0, 0, W, H, 'dark')
        txt(c, 'YOUR STARTUP IS WORTH', 782, 23, 'paper', 'Display', x=34)
        txt(c, '$900M.', 685, 111, 'paper', x=30, max_width=345)
        # Original printed card, not an approximate recreation.
        card = next(card for card in deck.CARDS if card['key'] == 'rockstar-cto')
        c.saveState()
        c.translate(410, 672)
        c.rotate(9)
        c.scale(.50, .50)
        deck.front(c, card)
        c.restoreState()
        txt(c, 'YOUR FRIEND JUST', 633, 46, 'coral')
        txt(c, 'STOLE YOUR CTO.', 581, 59, 'coral')
        identity(c, 'paper', meta=False)
        footer(c, 'SEE WHAT HAPPENS NEXT', 'paper', variant, letter)
    else:
        box(c, 0, 0, W, H, 'violet')
        box(c, 32, 777, 531, 29, 'ink')
        txt(c, 'THINK YOU CAN BUILD A', 784, 17, 'paper', 'Display')
        txt(c, '$1 BILLION', 675, 112)
        txt(c, 'STARTUP?', 606, 70)
        txt(c, 'YOUR FRIENDS HAVE OTHER PLANS.', 570, 20, 'ink', 'Display')
        identity(c, meta=True)
        footer(c, 'TAKE THE $1B CHALLENGE', 'ink', variant, letter)
    url = f'https://www.unicornthegame.com/ivey-{variant}'
    matrix = qr_matrix(url)
    export_qr(matrix, variant)
    draw_qr(c, matrix)
    c.linkURL(url, ((W - QR_SIZE) / 2, QR_Y, (W + QR_SIZE) / 2, QR_Y + QR_SIZE), relative=0)
    c.showPage()
    c.save()
    return {'poster': letter, 'variant': variant, 'url': url, 'pdf': str(path.relative_to(OUT)),
            'qr_svg': f'qr/ivey-{variant}.svg', 'qr_png': f'qr/ivey-{variant}.png',
            'qr_mm': round(QR_SIZE / 72 * 25.4, 1), 'quiet_zone_modules': 4,
            'error_correction': 'M'}


if __name__ == '__main__':
    manifest = [poster(v, a, name) for v, a, name in
                [('build', 'A', 'Build'), ('cto', 'B', 'CTO'), ('billion', 'C', 'Billion')]]
    (OUT / 'campaign.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps(manifest, indent=2))
