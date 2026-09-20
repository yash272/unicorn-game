"""Generate all three UNICORN PDFs from game/cards.json and game/rules.json."""
import json, shutil
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle

SITE = Path(__file__).resolve().parents[1]
OUT = SITE.parent / 'output/pdf'
OUT.mkdir(parents=True, exist_ok=True)
DATA = json.loads((SITE / 'game/cards.json').read_text())
CARDS = DATA['cards']
RULES = json.loads((SITE / 'game/rules.json').read_text())['blocks']
FONTS = SITE / 'public/fonts'
for name, file in [('Display','HTxwL3I-JCGChYJ8VI-L6OO_au7B46r2_3E.ttf'),('Heavy','HTxwL3I-JCGChYJ8VI-L6OO_au7B47b1_3E.ttf'),('Body','rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwAopxhTg.ttf'),('Bold','rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwARZthTg.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(FONTS / file)))
C = {k:HexColor(v) for k,v in dict(ink='#202024',paper='#F5F0E6',cyan='#87D4EE',lime='#DDFA83',blue='#8BAFFF',coral='#FF806C',yellow='#F3D67E',violet='#AE91FF',pink='#EF9FD0',muted='#625F62',white='#FFFFFF').items()}

def rect(c,x,y,w,h,color,r=0):
    c.setFillColor(C.get(color,color)); c.setStrokeColor(C['ink'])
    if r: c.roundRect(x,y,w,h,r,stroke=0,fill=1)
    else: c.rect(x,y,w,h,stroke=0,fill=1)
def text(c,t,x,y,size=10,font='Body',color='ink'):
    c.setFillColor(C[color]); c.setFont(font,size); c.drawString(x,y,t)
def para(c,t,x,top,w,size=10,font='Body',color='ink',leading=None):
    p=Paragraph(escape(t),ParagraphStyle('p',fontName=font,fontSize=size,leading=leading or size*1.3,textColor=C[color]))
    _,h=p.wrap(w,900); p.drawOn(c,x,top-h); return top-h

def title_lines(t,width,size):
    lines=[]; line=''
    for word in t.split():
        candidate=(line+' '+word).strip()
        if pdfmetrics.stringWidth(candidate,'Display',size)>width and line: lines.append(line);line=word
        else: line=candidate
    return lines+[line]

def front(c,card,x=0,y=0):
    c.saveState(); c.translate(x,y)
    rect(c,0,0,180,252,'ink',9);rect(c,1.5,1.5,177,249,card['color'],8)
    text(c,card['category'].upper(),12,235,7.5,'Bold')
    text(c,card['id'],150,235,7,'Bold')
    size=25
    while len(title_lines(card['name'].upper(),156,size))>2: size-=1
    for i,line in enumerate(title_lines(card['name'].upper(),156,size)):
        text(c,line,12,210-i*(size*.98),size,'Display')
    rect(c,10,137,160,44 if card['key']=='pr-crisis' else 37,'ink',5)
    if card['role']=='reference':
        big,label=('$1B','THE FINISH LINE') if card['key']=='unicorn' else ('QUICK RULES','KEEP BESIDE THE TABLE')
    elif card.get('outcome'):
        big,label=card['outcome']['headline'],card['outcome']['caption']
    else:
        big=f"+${card['value']}M"
        label='STARTING VALUATION' if card['role']=='startup' else ('VALUATION IN YOUR STARTUP' if card['role']=='asset' else 'VALUATION IF BANKED')
    headline_size=28 if card['key']=='pr-crisis' else 22
    while pdfmetrics.stringWidth(big,'Display',headline_size)>144: headline_size-=.5
    text(c,big,18,152,headline_size,'Display','paper')
    label_size=6.1
    while pdfmetrics.stringWidth(label,'Bold',label_size)>144: label_size-=.1
    text(c,label,18,142,label_size,'Bold','paper')
    heading='HOW TO USE' if card['role'] in ('startup','reference','asset') else ('REACTION FROM YOUR HAND' if card['role']=='reaction' else 'PLAY THIS EFFECT')
    text(c,heading,12,122,7,'Bold')
    bottom=para(c,card['effect'],12,114,156,9.1,leading=11.4)
    assert bottom>=32, (card['name'],bottom)
    c.setStrokeColor(C['ink']);c.setLineWidth(.5);c.line(12,28,168,28)
    text(c,'UNICORN',12,14,10,'Display')
    if card.get('outcome'):
        bank=f"Bank instead: +${card['value']}M"
        text(c,bank,168-pdfmetrics.stringWidth(bank,'Body',7),15,7,'Body')
    elif card['role']=='reference':
        text(c,'REFERENCE',128,15,5.8,'Bold')
    c.restoreState()

def back(c,x=0,y=0):
    # Restore the original violet orbit design, without edition labels.
    c.saveState();c.translate(x,y)
    clip=c.beginPath();clip.roundRect(0,0,180,252,8);c.clipPath(clip,stroke=0,fill=0)
    rect(c,0,0,180,252,HexColor('#15101D'),8)
    c.setStrokeColor(C['violet']);c.setLineWidth(.7);c.roundRect(8,8,164,236,5,stroke=1,fill=0)
    c.setStrokeColor(HexColor('#30233F'))
    for yy in [0,252]:
        for rr in [45,65,85,105]:c.circle(90,yy,rr,stroke=1,fill=0)
    def centered(t,y,font,size,color):
        c.setFillColor(HexColor(color));c.setFont(font,size);c.drawCentredString(90,y,t)
    centered('BUILD. RAISE. HIRE. ATTACK.',220,'Bold',6.3,'#AE91FF')
    c.drawImage(str(SITE/'public/images/card-back-sparkles.png'),67,151,46,46,mask='auto')
    centered('UNICORN',119,'Heavy',34,'#EDE6DA')
    centered('FIRST STARTUP TO $1B WINS.',100,'Bold',6.5,'#AE91FF')
    c.setStrokeColor(HexColor('#59436F'));c.setLineWidth(.5);c.line(34,84,146,84)
    centered('FRIENDSHIP IS A LIABILITY.',65,'Body',6.4,'#C7B2DD')
    c.restoreState()

def crop(c,x,y):
    c.setStrokeColor(C['muted']);c.setLineWidth(.35)
    for xx in (x,x+180):
        for yy in (y,y+252):
            dx=-1 if xx==x else 1;dy=-1 if yy==y else 1
            c.line(xx+dx*2,yy,xx+dx*6,yy);c.line(xx,yy+dy*2,xx,yy+dy*6)

def page_header(c,kicker,heading,page):
    rect(c,0,0,792,612,'paper');text(c,'UNICORN / '+kicker,36,578,9,'Bold');text(c,heading,36,533,37,'Display')
    c.setStrokeColor(C['ink']);c.line(36,516,756,516)
    text(c,'EDITION 02 • VALUATION ONLY • EARLY PLAYTEST',36,20,7,'Bold','muted');text(c,f'{page:02}',741,20,8,'Bold')

def printable():
    path=OUT/'UNICORN-printable-deck.pdf';c=canvas.Canvas(str(path),pagesize=(792,612));c.setTitle('UNICORN | Complete printable deck and rules | Edition 02')
    page_header(c,'PRINT & PLAY','ONE BILLION. ONE WINNER.',1)
    text(c,'120',36,397,100,'Heavy');text(c,'PHYSICAL CARDS',42,370,12,'Bold')
    text(c,'3–5',300,411,58,'Heavy');text(c,'PLAYERS',303,385,11,'Bold')
    text(c,'~45',537,411,58,'Heavy');text(c,'MINUTES: PLAYTEST TARGET',540,385,10,'Bold')
    y=329
    for title,body in [('What is inside','100 main-deck cards, 15 Startup cards and 5 Reference cards. Every playable card has a defined value and effect. All five startups begin at $50M.'),('How to print','Pages 7–46 contain 20 paired front/back sheets, with six poker-size cards per sheet (2.5 × 3.5 inches). Print landscape at 100% / Actual Size. Use duplex with short-edge flipping. Test pages 7–8 before printing the full set.'),('How to assemble','Cut on the corner marks. Use opaque sleeves with a spare playing card behind each print for a consistent feel. Or print only the odd-numbered card pages and use opaque sleeves.'),('Start playing','Read pages 3–6. Shuffle only the 100-card main deck, deal 5 hidden cards each, then choose a Startup. No special attack or defense is guaranteed.')]:
        text(c,title.upper(),36,y,11,'Bold');y=para(c,body,36,y-9,714,11)-25
    c.showPage();page_header(c,'DECK INDEX','EVERY CARD. EVERY COPY.',2)
    for col,group in enumerate([CARDS[:20],CARDS[20:]]):
        x=36+col*372;y=495
        text(c,'CARD',x,y,8,'Bold');text(c,'BANK / BASE',x+235,y,8,'Bold');text(c,'COPIES',x+290,y,8,'Bold');y-=19
        for d in group:
            label=f"{d['id']}  {d['name']}"
            text(c,label,x,y,9,'Body');text(c,'REF' if d['role']=='reference' else f"+${d['value']}M",x+235,y,9,'Bold');text(c,str(d['copies']),x+303,y,9,'Bold');y-=21
    c.showPage()
    headings={3:'DEAL FIVE. DRAW ONE. PLAY TWO.',4:'ONE CARD. ONE CHOICE.',5:'TOGETHER, UNTIL FURTHER NOTICE.',6:'SETTLE THE TABLE DEBATE.'}
    for p in range(3,7):
        page_header(c,'GAMEPLAY RULES',headings[p],p)
        for col in range(2):
            x=36+col*372;y=491
            for b in [r for r in RULES if r['page']==p and r['column']==col]:
                text(c,b['title'].upper(),x,y,17,'Display');y-=10
                for body in b['paragraphs']:y=para(c,body,x,y,344,10.2,leading=13.1)-8
                y-=12
            assert y>35,(p,col,y)
        c.showPage()
    deck=[d for d in CARDS for _ in range(d['copies'])]
    for sheet in range(20):
        for i,d in enumerate(deck[sheet*6:sheet*6+6]):
            x=108+(i%3)*198;y=315-(i//3)*270;front(c,d,x,y);crop(c,x,y)
        text(c,f'UNICORN • ED.02 • SHEET {sheet+1:02}/20 • FRONTS • PRINT AT 100%',108,20,7,'Bold','muted');c.showPage()
        for i in range(6):
            x=108+(i%3)*198;y=315-(i//3)*270;back(c,x,y);crop(c,x,y)
        text(c,f'UNICORN • ED.02 • SHEET {sheet+1:02}/20 • BACKS • SHORT-EDGE DUPLEX',108,20,7,'Bold','muted');c.showPage()
    c.save();return path

def individual():
    path=OUT/'UNICORN-individual-cards.pdf';c=canvas.Canvas(str(path),pagesize=(180,252));c.setTitle('UNICORN | 40 card designs + universal back | Edition 02')
    for card in CARDS:front(c,card);c.showPage()
    back(c);c.showPage();c.save();return path

def concept():
    path=OUT/'UNICORN-founder-concept-one-page.pdf';c=canvas.Canvas(str(path),pagesize=(612,792));c.setTitle('UNICORN | The concept in one page | Edition 02')
    rect(c,0,0,612,792,'paper');rect(c,0,664,612,128,'ink')
    text(c,'UNICORN',28,729,55,'Heavy','lime');text(c,'BUILD A STARTUP. BETRAY YOUR FRIENDS.',30,703,14,'Display','paper')
    text(c,'First to $1B valuation wins. Only one of you.',30,679,12,'Body','paper')
    text(c,'3–5 PLAYERS   /   ~45 MIN TARGET   /   VALUATION ONLY',28,642,9,'Bold')
    text(c,'THE WHOLE TURN',28,615,17,'Display')
    flow=[('01','DRAW 1','Keep at most 7 cards. Discard any excess immediately.'),('02','PLAY UP TO 2','Use an effect OR place a card face-up for its valuation.'),('03','COUNT & PASS','End your turn at $1,000M after reactions to win.')]
    for i,(num,title,body) in enumerate(flow):
        x=28+i*190;rect(c,x,514,176,89,'lime' if i==0 else 'white',6)
        text(c,num,x+10,580,11,'Bold');text(c,title,x+34,579,16,'Display');para(c,body,x+10,565,156,9.5)
    para(c,'SETUP: Choose 1 of 3 Startup cards; start at $50M. Deal 5 random cards to each player. Keep your hand hidden. Your startup stays face-up.',28,500,556,10,'Body')
    rect(c,28,405,556,52,'ink',5)
    text(c,'YOUR HAND HOLDS THE MYSTERY.',40,440,12,'Display','lime')
    para(c,'Bank a tactic for +$10M, or keep it to attack or defend. A banked card cannot use its effect later. Defenses from hand are free reactions.',40,433,530,9,'Body','paper',11)
    text(c,'NINE CARDS THAT EXPLAIN THE GAME',28,385,17,'Display')
    examples=[
        ('chief-scientist','Place in your startup. You may share this Employee in a Joint Venture.'),
        ('poach','Move a rival’s positive-value card into your startup. Shared Employees count.'),
        ('investor','Give the target +$50M. Take 1 random card from their hidden hand.'),
        ('founder-scandal','Privately look at all their cards. Return their hand unchanged.'),
        ('joint-venture','Both agree and commit 1 Employee each. Both count both Employees.'),
        ('ditch','Keep both shared Employees. Your value stays; your partner loses theirs.'),
        ('golden-handcuffs','Cancel Poach. Against Ditch, defender keeps both Employees; the venture ends.'),
        ('patent-lawsuit','Target skips their next whole turn, including the draw. Then discard this.'),
        ('pr-crisis','Penalty stays beside the rival until Crisis PR Team removes it.')]
    for i,(key,body) in enumerate(examples):
        d=next(d for d in CARDS if d['key']==key);x=28+(i%3)*190;y=268-(i//3)*114
        rect(c,x,y,176,105,d['color'],6)
        text(c,d['category'].upper(),x+10,y+93,6.5,'Bold')
        size=16 if len(d['name'])<17 else 14
        text(c,d['name'].upper(),x+10,y+77,size,'Display')
        headline=d['outcome']['headline'] if d.get('outcome') else f"+${d['value']}M"
        hs=23 if key=='pr-crisis' else 20
        while pdfmetrics.stringWidth(headline,'Display',hs)>156:hs-=.5
        text(c,headline,x+10,y+56,hs,'Display')
        low=para(c,body,x+10,y+49,156,8.3,leading=10.2);assert low>=y+16,(key,low,y)
        bank=f"Bank instead: +${d['value']}M" if d.get('outcome') else 'VALUATION IN YOUR STARTUP'
        text(c,bank,x+166-pdfmetrics.stringWidth(bank,'Body',6.7),y+7,6.7,'Body')
    rect(c,28,13,556,24,'ink',4)
    text(c,'NO EARLY ELIMINATION. YOUR PARTNER DOES NOT SHARE YOUR WIN.',38,30,8,'Bold','paper')
    text(c,'Early prototype • Timing and balance need playtesting • Full deck includes all defenses and complete rules.',38,20,6.6,'Body','paper')
    c.save();return path

if __name__=='__main__':
    paths=[printable(),individual(),concept()]
    target=SITE/'public/downloads';target.mkdir(parents=True,exist_ok=True)
    for path in paths:shutil.copy2(path,target/path.name);print(path)
