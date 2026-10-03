import catalog from './cards.json' with { type: 'json' };

export type Scenario = 'poach' | 'investor' | 'founder-scandal' | 'strategic-alliance' | 'alliance-trade' | 'ditch' | 'patent-lawsuit' | 'pr-crisis' | 'cease-and-desist';
export type Stage = 'ready' | 'played' | 'blocked' | 'banked' | 'skipped' | 'stolen';
export type PlayerId = 'neural' | 'rocket' | 'flash' | 'fin';
export type Instance = { id: string; key: string };
export type Player = { id: PlayerId; name: string; sector: string; color: string; subtotal: number; cards: Instance[]; hand: Instance[]; penalties: number[]; skipNextTurn: boolean; skipped: boolean };
export type Alliance = { a: PlayerId; b: PlayerId };
export type TableState = { players: Player[]; alliance: Alliance | null; revealedTo: PlayerId | null; revealedPlayer: PlayerId | null; discarded: Instance[] };
export const scenarios: { key: Scenario; label: string; action: string; defense?: string; message: string }[] = [
  { key: 'poach', label: 'Poach', action: 'Poach their scientist', defense: 'golden-handcuffs', message: 'Neural AI wants Flash Commerce’s Chief Scientist. A card in their hand might stop it.' },
  { key: 'investor', label: 'Investor', action: 'Offer $50M valuation', defense: 'not-for-sale', message: 'Give Flash Commerce the Investor card for +$50M. In exchange, take one random card from their hand.' },
  { key: 'founder-scandal', label: 'Founder Scandal', action: 'See their hand, then steal', defense: 'crisis-pr-team', message: 'Privately see Flash Commerce’s entire hand, then choose one card to steal. Everyone else is left guessing.' },
  { key: 'strategic-alliance', label: 'Strategic Alliance', action: 'Agree to ally up', message: 'Invite Flash Commerce to an alliance. Both must agree. Your cards and valuations stay separate; you can trade hand cards and defend each other.' },
  { key: 'alliance-trade', label: 'Trade with your ally', action: 'Agree to swap hand cards', message: 'You offer Viral Launch. Flash Commerce offers Golden Handcuffs. Both agree before swapping; it uses one of your two card plays.' },
  { key: 'ditch', label: 'Ditch', action: 'Ditch your partner', defense: 'golden-handcuffs', message: 'Ditch your ally and take their Chief Scientist. Golden Handcuffs can reverse it: they take your CTO instead. Either way, the alliance ends.' },
  { key: 'patent-lawsuit', label: 'Patent Lawsuit', action: 'File the lawsuit', defense: 'best-lawyers', message: 'Flash Commerce will miss its next whole turn, including its draw. A lawyer can stop the lawsuit.' },
  { key: 'cease-and-desist', label: 'Cease & Desist', action: 'Send their launch back', defense: 'best-lawyers', message: 'Return Flash Commerce’s Viral Launch to their hand. They lose its $125M until they play it again.' },
  { key: 'pr-crisis', label: 'PR Crisis', action: 'Start a PR crisis', defense: 'crisis-pr-team', message: 'A visible -$75M penalty stays beside Flash Commerce until Crisis PR Team removes it.' },
];
export function cardInfo(key: string) {
  const card = catalog.cards.find(c => c.key === key);
  if (!card) throw new Error(`Unknown card: ${key}`);
  return card;
}
export function valueOf(player: Player): number {
  return Math.max(0, player.subtotal + player.cards.reduce((n, c) => n + cardInfo(c.key).value, 0) + player.penalties.reduce((a, b) => a + b, 0));
}
export function limitHand<T>(hand: T[], discardIndices: number[]): { hand: T[]; discarded: T[] } {
  const needed = Math.max(0, hand.length - catalog.handLimit);
  if (discardIndices.length !== needed || new Set(discardIndices).size !== needed || discardIndices.some(i => !Number.isInteger(i) || i < 0 || i >= hand.length)) throw new Error(`Choose exactly ${needed} cards to discard`);
  return { hand: hand.filter((_, i) => !discardIndices.includes(i)), discarded: hand.filter((_, i) => discardIndices.includes(i)) };
}
export function returnGrowthToHand(player: Player, cardId: string, discardIndices: number[] = []): Instance[] {
  const index = player.cards.findIndex(c => c.id === cardId);
  if (index < 0 || cardInfo(player.cards[index].key).category !== 'Growth') throw new Error('Choose a Growth card in the target startup');
  const limited = limitHand([...player.hand, player.cards[index]], discardIndices);
  player.cards.splice(index, 1);
  player.hand = limited.hand;
  return limited.discarded;
}
export function freshTable(scenario: Scenario): TableState {
  const setup = scenarios.find(s => s.key === scenario)!;
  const instance = (key: string, id: string): Instance => ({ key, id });
  const players: Player[] = [
    { id: 'neural', name: 'Neural AI', sector: 'AI / YOU', color: 'violet', subtotal: 625, cards: [instance('rockstar-cto', 'cto')], hand: [instance(scenario === 'alliance-trade' ? 'viral-launch' : scenario, 'action'), instance('viral-launch', 'your-launch'), instance('golden-handcuffs', 'your-defense'), instance('elite-engineer', 'your-engineer'), instance('founder-scandal', 'your-scandal')], penalties: [], skipNextTurn: false, skipped: false },
    { id: 'rocket', name: 'RocketWorks', sector: 'SPACE', color: 'coral', subtotal: 550, cards: [], hand: [], penalties: [], skipNextTurn: false, skipped: false },
    { id: 'flash', name: 'Flash Commerce', sector: 'CONSUMER', color: 'lime', subtotal: 305, cards: [instance('chief-scientist', 'scientist')], hand: [instance('ditch', 'their-ditch'), instance(setup.defense || 'golden-handcuffs', 'their-defense'), instance('investor', 'their-investor'), instance('patent-lawsuit', 'their-lawsuit'), instance('viral-launch', 'their-launch')], penalties: [], skipNextTurn: false, skipped: false },
    { id: 'fin', name: 'FinPay', sector: 'FINTECH', color: 'cyan', subtotal: 300, cards: [], hand: [], penalties: [], skipNextTurn: false, skipped: false },
  ];
  if (scenario === 'cease-and-desist') {
    players[2].subtotal = 180;
    players[2].cards.push(instance('viral-launch', 'growth-demo'));
  }
  const state: TableState = { players, alliance: null, revealedTo: null, revealedPlayer: null, discarded: [] };
  if (scenario === 'ditch' || scenario === 'alliance-trade') formAlliance(state);
  return state;
}
function formAlliance(state: TableState) {
  state.alliance = {a:'neural',b:'flash'};
}
function resolveDitch(state: TableState, defenderWins: boolean) {
  if (!state.alliance) throw new Error('Ditch needs an active Strategic Alliance');
  const from=state.players[defenderWins ? 0 : 2], to=state.players[defenderWins ? 2 : 0];
  to.cards.push(from.cards.splice(0,1)[0]);
  state.alliance=null;
}
/** Scripted mid-game examples, not a multiplayer game or a shuffled starting deal. */
export function resolveDemo(scenario: Scenario, stage: Stage, randomIndex = 0): TableState {
  if (scenario === 'alliance-trade' && stage === 'banked') throw new Error('A hand trade is not a card you can bank');
  if (stage === 'stolen' && scenario !== 'founder-scandal') throw new Error('Only Founder Scandal chooses a hand card to steal');
  if (stage === 'skipped' && scenario !== 'patent-lawsuit') throw new Error('Only Patent Lawsuit skips a turn');
  const state = freshTable(scenario);
  if (stage === 'ready') return state;
  const actor = state.players[0], target = state.players[2];
  const action = actor.hand.shift()!;
  if (stage === 'banked') { actor.cards.push(action); return state; }
  const blocked = stage === 'blocked';
  if (blocked) {
    if (!scenarios.find(s => s.key === scenario)?.defense) throw new Error('This example has no defense');
    state.discarded.push(target.hand.splice(1, 1)[0], action);
    if (scenario === 'ditch') resolveDitch(state, true);
    return state;
  }
  switch (scenario) {
    case 'poach': actor.cards.push(target.cards.splice(0, 1)[0]); state.discarded.push(action); break;
    case 'investor': {
      if (!Number.isInteger(randomIndex) || randomIndex < 0 || randomIndex >= target.hand.length) throw new Error('Choose a card back in the target hand');
      actor.hand.push(target.hand.splice(randomIndex, 1)[0]); target.cards.push(action); break;
    }
    case 'founder-scandal':
      if (stage === 'stolen') {
        if (!Number.isInteger(randomIndex) || randomIndex < 0 || randomIndex >= target.hand.length) throw new Error('Choose one card from the revealed hand');
        actor.hand.push(target.hand.splice(randomIndex, 1)[0]);
        state.discarded.push(action);
      } else { state.revealedTo = actor.id; state.revealedPlayer = target.id; }
      break;
    case 'strategic-alliance': formAlliance(state); break;
    case 'alliance-trade': actor.hand.push(target.hand.splice(1,1)[0]); target.hand.push(action); break;
    case 'ditch': resolveDitch(state, false); state.discarded.push(action); break;
    case 'patent-lawsuit': target.skipNextTurn = stage !== 'skipped'; target.skipped = stage === 'skipped'; if (stage === 'skipped') state.discarded.push(action); break;
    case 'pr-crisis': target.penalties.push(-75); break;
    case 'cease-and-desist': state.discarded.push(...returnGrowthToHand(target, 'growth-demo'), action); break;

  }
  return state;
}
