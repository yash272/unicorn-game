import { test } from 'node:test';
import assert from 'node:assert/strict';
import catalog from '../game/cards.json' with { type: 'json' };
import { freshTable, resolveDemo, valueOf, limitHand, scenarios, passCardsLeft, returnGrowthToHand } from '../game/demo.ts';
const totals = state => state.players.map(p => valueOf(p, state.venture));
test('complete deck has 100 playable, 15 startup and 5 reference cards', () => {
  assert.equal(new Set(catalog.cards.map(c=>c.key)).size,41);
  for(const [roles,count] of [[['startup'],15],[['reference'],5]]) assert.equal(catalog.cards.filter(c=>roles.includes(c.role)).reduce((n,c)=>n+c.copies,0),count);
  const playable=catalog.cards.filter(c=>!['startup','reference'].includes(c.role));
  assert.equal(playable.reduce((n,c)=>n+c.copies,0),100);
  for(const c of playable) { assert.ok(c.value>0);assert.ok(c.effect.trim());assert.ok(!/undefined|TBD|cash|market/i.test(c.effect));if(['Attack','Defense'].includes(c.category))assert.equal(c.value,10); }
});
test('Poach transfers an employee and its value',()=> {const s=resolveDemo('poach','played');assert.deepEqual(totals(s),[850,550,305,300]);assert.ok(s.players[0].cards.some(c=>c.id==='scientist'));assert.equal(s.discarded[0].key,'poach');});
test('Investor gives the target 50 and transfers exactly one random hidden card',()=>{
  for(let i=0;i<5;i++){const before=freshTable('investor'),s=resolveDemo('investor','played',i);assert.deepEqual(totals(s),[725,550,480,300]);assert.equal(s.players[0].hand.at(-1).id,before.players[2].hand[i].id);assert.equal(s.players[0].hand.length,5);assert.equal(s.players[2].hand.length,4);assert.equal(s.players[2].cards.at(-1).key,'investor');}
  const blocked=resolveDemo('investor','blocked');assert.deepEqual(totals(blocked),[725,550,430,300]);assert.equal(blocked.players[0].hand.length,4);assert.equal(blocked.players[2].hand.length,4);
});
test('Scandal reveals only to its actor, leaving the target hand and values unchanged',()=>{const before=freshTable('founder-scandal'),s=resolveDemo('founder-scandal','played');assert.equal(s.revealedTo,'neural');assert.equal(s.revealedPlayer,'flash');assert.deepEqual(s.players[2].hand,before.players[2].hand);assert.deepEqual(totals(s),totals(before));assert.equal(resolveDemo('founder-scandal','blocked').revealedTo,null);});
test('Joint Venture shares exactly the two contributed Employees',()=>{const s=resolveDemo('joint-venture','played');assert.deepEqual(totals(s),[800,550,900,300]);assert.equal(s.venture.employees.length,2);assert.equal(s.players[0].cards.length,0);assert.equal(s.players[2].cards.length,0);});
test('Ditch preserves attacker value and removes both shared values from the partner',()=>{const s=resolveDemo('ditch','played');assert.deepEqual(totals(s),[800,550,675,300]);assert.equal(s.venture,null);assert.equal(s.players[0].cards.length,2);});
test('blocked Ditch gives both Employees to the defender without inflating their value',()=>{const s=resolveDemo('ditch','blocked');assert.deepEqual(totals(s),[575,550,900,300]);assert.equal(s.venture,null);assert.equal(s.players[2].cards.length,2);assert.ok(s.discarded.some(c=>c.key==='golden-handcuffs'));});
test('banking adds the printed value and never activates the effect',()=>{for(const scenario of scenarios){const before=freshTable(scenario.key),s=resolveDemo(scenario.key,'banked');const amount=scenario.key==='investor'?50:10;assert.equal(totals(s)[0],totals(before)[0]+amount);assert.equal(totals(s)[2],totals(before)[2]);assert.deepEqual(s.venture,before.venture);assert.equal(s.revealedTo,null);assert.equal(s.players[2].skipNextTurn,false);assert.equal(s.discarded.length,0);}});
test('Patent Lawsuit skips one whole turn without drawing or changing valuation',()=>{const pending=resolveDemo('patent-lawsuit','played'),skipped=resolveDemo('patent-lawsuit','skipped');assert.equal(pending.players[2].skipNextTurn,true);assert.equal(skipped.players[2].skipNextTurn,false);assert.equal(skipped.players[2].skipped,true);assert.deepEqual(pending.players[2].hand,skipped.players[2].hand);assert.deepEqual(totals(pending),totals(skipped));assert.equal(resolveDemo('patent-lawsuit','blocked').players[2].skipNextTurn,false);});
test('PR Crisis adds a persistent 75 penalty and valuation has a zero floor',()=>{const s=resolveDemo('pr-crisis','played');assert.deepEqual(totals(s),[725,550,355,300]);s.players[2].penalties=[-1000];assert.equal(valueOf(s.players[2],s.venture),0);assert.deepEqual(resolveDemo('pr-crisis','blocked').players[2].penalties,[]);});
test('the strict hand limit rejects missing, duplicate and invalid discards',()=>{const h=[0,1,2,3,4,5,6,7,8];assert.deepEqual(limitHand(h,[1,8]),{hand:[0,2,3,4,5,6,7],discarded:[1,8]});for(const d of [[],[1],[1,1],[1,9],[0.5,1]])assert.throws(()=>limitHand(h,d));assert.deepEqual(limitHand([1,2],[]).hand,[1,2]);});

test('the accepted mix is four Ditch, two Mixer and two Cease & Desist',()=>{
  const find=key=>catalog.cards.find(c=>c.key===key);
  assert.equal(find('ditch').copies,4);assert.equal(find('founder-mixer').copies,2);assert.equal(find('cease-and-desist').copies,2);
  assert.equal(find('hostile-acquisition'),undefined);assert.equal(find('pitch-deck-leak'),undefined);
  assert.ok(!JSON.stringify(catalog).includes('Hostile Acquisition'));
  assert.match(find('best-lawyers').effect,/Cease & Desist/);
});
test('Cease & Desist returns Growth to hand, with no valuation gain for the attacker',()=>{
  const before=freshTable('cease-and-desist'),after=resolveDemo('cease-and-desist','played');
  assert.deepEqual(totals(before),[725,550,430,300]);assert.deepEqual(totals(after),[725,550,305,300]);
  assert.equal(after.players[2].hand.length,6);assert.ok(after.players[2].hand.some(c=>c.id==='growth-demo'));
  assert.deepEqual(totals(resolveDemo('cease-and-desist','blocked')),totals(before));
});
test('returning Growth enforces the hand cap and rejects Employee targets before mutation',()=>{
  const p=freshTable('cease-and-desist').players[2];
  p.hand.push({id:'extra-1',key:'poach'},{id:'extra-2',key:'ditch'});const snapshot=structuredClone(p);
  assert.throws(()=>returnGrowthToHand(p,'growth-demo'),/discard/);assert.deepEqual(p,snapshot);
  assert.throws(()=>returnGrowthToHand(p,'scientist',[0]),/Growth/);assert.deepEqual(p,snapshot);
  const discard=returnGrowthToHand(p,'growth-demo',[0]);assert.equal(p.hand.length,7);assert.equal(discard[0].id,'their-ditch');assert.ok(p.hand.some(c=>c.id==='growth-demo'));
});
test('Mixer selections come from the original hands and pass exactly one seat',()=>{
  const hands=[['a','b'],['c','d'],['e','f'],['g','h']];
  assert.deepEqual(passCardsLeft(hands,[1,0,1,0]),[['a','g'],['d','b'],['e','c'],['h','f']]);
  assert.deepEqual(hands,[['a','b'],['c','d'],['e','f'],['g','h']]);
});
test('Mixer handles empty hands, wraps around and keeps cards unique for 3–5 players',()=>{
  for(const n of [3,4,5]){
    const hands=Array.from({length:n},(_,i)=>i===1?[]:[`${i}a`,`${i}b`]);const choices=hands.map(h=>h.length?0:null);const after=passCardsLeft(hands,choices);
    assert.deepEqual(after.flat().sort(),hands.flat().sort());assert.equal(after[1].at(-1),'0a');assert.equal(after[2].length,1);assert.equal(after[0].at(-1),`${n-1}a`);
  }
  assert.deepEqual(passCardsLeft([[],[],[]],[null,null,null]),[[],[],[]]);
  assert.throws(()=>passCardsLeft([['a'],[],['b']],[null,null,0]));
  assert.throws(()=>passCardsLeft([['a'],[],['b']],[0,0,0]));
});
test('the Mixer demo passes from the remaining hand and discards Mixer after resolving',()=>{
  const before=freshTable('founder-mixer'),after=resolveDemo('founder-mixer','played');
  assert.deepEqual(totals(after),totals(before));assert.equal(after.discarded[0].key,'founder-mixer');
  assert.ok(!after.players.some(p=>p.hand.some(c=>c.id==='action')));
  assert.equal(after.players[0].hand.at(-1).id,'fin-pr');assert.equal(after.players[1].hand.at(-1).id,'your-launch');
  assert.ok(after.players.every(p=>p.hand.length<=7));assert.equal(after.revealedTo,null);
});
