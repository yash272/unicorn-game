import { test } from 'node:test';
import assert from 'node:assert/strict';
import catalog from '../game/cards.json' with { type: 'json' };
import { freshTable, resolveDemo, valueOf, limitHand, scenarios, returnGrowthToHand } from '../game/demo.ts';
const totals = state => state.players.map(p => valueOf(p));
test('complete deck has 98 playable, 15 startup and 5 reference cards', () => {
  assert.equal(new Set(catalog.cards.map(c=>c.key)).size,40);
  for(const [roles,count] of [[['startup'],15],[['reference'],5]]) assert.equal(catalog.cards.filter(c=>roles.includes(c.role)).reduce((n,c)=>n+c.copies,0),count);
  const playable=catalog.cards.filter(c=>!['startup','reference'].includes(c.role));
  assert.equal(playable.reduce((n,c)=>n+c.copies,0),98);
  for(const c of playable) { assert.ok(c.value>0);assert.ok(c.effect.trim());assert.ok(!/undefined|TBD|cash|market/i.test(c.effect));if(['Attack','Defense'].includes(c.category))assert.equal(c.value,10); }
});
test('Poach transfers an employee and its value',()=> {const s=resolveDemo('poach','played');assert.deepEqual(totals(s),[850,550,305,300]);assert.ok(s.players[0].cards.some(c=>c.id==='scientist'));assert.equal(s.discarded[0].key,'poach');});
test('Investor gives the target 50 and transfers exactly one random hidden card',()=>{
  for(let i=0;i<5;i++){const before=freshTable('investor'),s=resolveDemo('investor','played',i);assert.deepEqual(totals(s),[725,550,480,300]);assert.equal(s.players[0].hand.at(-1).id,before.players[2].hand[i].id);assert.equal(s.players[0].hand.length,5);assert.equal(s.players[2].hand.length,4);assert.equal(s.players[2].cards.at(-1).key,'investor');}
  const blocked=resolveDemo('investor','blocked');assert.deepEqual(totals(blocked),[725,550,430,300]);assert.equal(blocked.players[0].hand.length,4);assert.equal(blocked.players[2].hand.length,4);
});
test('Scandal reveals privately, then takes the chosen card without changing valuation',()=>{
  const before=freshTable('founder-scandal');
  const revealed=resolveDemo('founder-scandal','played');
  assert.equal(revealed.revealedTo,'neural');
  assert.deepEqual(revealed.players[2].hand,before.players[2].hand);
  const stolen=resolveDemo('founder-scandal','stolen',3);
  assert.equal(stolen.players[0].hand.at(-1).id,'their-lawsuit');
  assert.equal(stolen.players[2].hand.length,4);
  assert.ok(!stolen.players[2].hand.some(c=>c.id==='their-lawsuit'));
  assert.deepEqual(totals(stolen),[725,550,430,300]);
  assert.equal(stolen.revealedTo,null);
  assert.equal(stolen.discarded[0].key,'founder-scandal');
  assert.equal(resolveDemo('founder-scandal','blocked').revealedTo,null);
  assert.throws(()=>resolveDemo('founder-scandal','stolen',5));
});
test('Strategic Alliance adds no valuation and moves no Employees',()=>{
 const s=resolveDemo('strategic-alliance','played');assert.deepEqual(totals(s),[725,550,430,300]);
 assert.deepEqual(s.alliance,{a:'neural',b:'flash'});assert.equal(s.players[0].cards.length,1);assert.equal(s.players[2].cards.length,1);
});
test('the alliance trade swaps hand cards without changing hand sizes or valuations',()=>{
 const before=freshTable('alliance-trade'),s=resolveDemo('alliance-trade','played');
 assert.equal(s.players[0].hand.at(-1).key,'golden-handcuffs');assert.equal(s.players[2].hand.at(-1).key,'viral-launch');
 assert.equal(s.players[0].hand.length,before.players[0].hand.length);assert.equal(s.players[2].hand.length,before.players[2].hand.length);
 assert.deepEqual(totals(s),[725,550,430,300]);assert.ok(s.alliance);
 assert.throws(()=>resolveDemo('alliance-trade','banked'),/trade/);
});
test('Ditch takes one banked card and ends the alliance',()=>{const s=resolveDemo('ditch','played');assert.deepEqual(totals(s),[850,550,305,300]);assert.equal(s.alliance,null);assert.equal(s.players[0].cards.length,2);});
test('blocked Ditch lets the defender take the attacker CTO and ends the alliance',()=>{const s=resolveDemo('ditch','blocked');assert.deepEqual(totals(s),[625,550,530,300]);assert.equal(s.alliance,null);assert.equal(s.players[2].cards.length,2);assert.ok(s.discarded.some(c=>c.key==='golden-handcuffs'));});
test('banking adds the printed value and never activates the effect',()=>{for(const scenario of scenarios.filter(s=>s.key!=='alliance-trade')){const before=freshTable(scenario.key),s=resolveDemo(scenario.key,'banked');const amount=scenario.key==='investor'?50:10;assert.equal(totals(s)[0],totals(before)[0]+amount);assert.equal(totals(s)[2],totals(before)[2]);assert.deepEqual(s.alliance,before.alliance);assert.equal(s.revealedTo,null);assert.equal(s.players[2].skipNextTurn,false);assert.equal(s.discarded.length,0);}});
test('Patent Lawsuit skips one whole turn without drawing or changing valuation',()=>{const pending=resolveDemo('patent-lawsuit','played'),skipped=resolveDemo('patent-lawsuit','skipped');assert.equal(pending.players[2].skipNextTurn,true);assert.equal(skipped.players[2].skipNextTurn,false);assert.equal(skipped.players[2].skipped,true);assert.deepEqual(pending.players[2].hand,skipped.players[2].hand);assert.deepEqual(totals(pending),totals(skipped));assert.equal(resolveDemo('patent-lawsuit','blocked').players[2].skipNextTurn,false);});
test('PR Crisis adds a persistent 75 penalty and valuation has a zero floor',()=>{const s=resolveDemo('pr-crisis','played');assert.deepEqual(totals(s),[725,550,355,300]);s.players[2].penalties=[-1000];assert.equal(valueOf(s.players[2],s.alliance),0);assert.deepEqual(resolveDemo('pr-crisis','blocked').players[2].penalties,[]);});
test('the strict hand limit rejects missing, duplicate and invalid discards',()=>{const h=[0,1,2,3,4,5,6,7,8];assert.deepEqual(limitHand(h,[1,8]),{hand:[0,2,3,4,5,6,7],discarded:[1,8]});for(const d of [[],[1],[1,1],[1,9],[0.5,1]])assert.throws(()=>limitHand(h,d));assert.deepEqual(limitHand([1,2],[]).hand,[1,2]);});

test('the accepted mix is four Ditch and three Cease & Desist, without Mixer',()=>{
  const find=key=>catalog.cards.find(c=>c.key===key);
  assert.equal(find('ditch').copies,4);assert.equal(find('founder-mixer'),undefined);assert.equal(find('cease-and-desist').copies,3);
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
