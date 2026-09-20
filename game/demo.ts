import catalog from './cards.json' with { type: 'json' };

export type Scenario = 'poach' | 'investor' | 'founder-scandal' | 'joint-venture' | 'ditch' | 'patent-lawsuit' | 'pr-crisis';
export type Stage = 'ready' | 'played' | 'blocked' | 'banked' | 'skipped';
export type PlayerId = 'neural' | 'rocket' | 'flash' | 'fin';
export type Instance = { id: string; key: string };
export type Player = { id: PlayerId; name: string; sector: string; color: string; subtotal: number; cards: Instance[]; hand: Instance[]; penalties: number[]; skipNextTurn: boolean; skipped: boolean };
export type Venture = { a: PlayerId; b: PlayerId; employees: { contributor: PlayerId; card: Instance }[] };
export type TableState = { players: Player[]; venture: Venture | null; revealedTo: PlayerId | null; revealedPlayer: PlayerId | null; discarded: Instance[] };
export const scenarios: { key: Scenario; label: string; action: string; defense?: string; message: string }[] = [
  { key: 'poach', label: 'Poach', action: 'Poach their scientist', defense: 'golden-handcuffs', message: 'Neural AI wants Flash Commerce’s Chief Scientist. A card in their hand might stop it.' },
  { key: 'investor', label: 'Investor', action: 'Offer $50M valuation', defense: 'not-for-sale', message: 'Give Flash Commerce the Investor card for +$50M. In exchange, take one random card from their hand.' },
  { key: 'founder-scandal', label: 'Founder Scandal', action: 'Look at their hand', defense: 'crisis-pr-team', message: 'Neural AI can privately inspect Flash Commerce’s whole hand. Everyone else is left guessing.' },
  { key: 'joint-venture', label: 'Joint Venture', action: 'Agree to partner up', message: 'Neural AI commits its CTO; Flash Commerce commits its Scientist. Each partner will count both Employees.' },
  { key: 'ditch', label: 'Ditch', action: 'Ditch your partner', defense: 'golden-handcuffs', message: 'You both count the shared $225M. Ditch keeps both Employees for Neural AI—unless Flash Commerce reverses it.' },
  { key: 'patent-lawsuit', label: 'Patent Lawsuit', action: 'File the lawsuit', defense: 'best-lawyers', message: 'Flash Commerce will miss its next whole turn, including its draw. A lawyer can stop the lawsuit.' },
  { key: 'pr-crisis', label: 'PR Crisis', action: 'Start a PR crisis', defense: 'crisis-pr-team', message: 'A visible -$75M penalty stays beside Flash Commerce until Crisis PR Team removes it.' },
];
export function cardInfo(key: string) {
  const card = catalog.cards.find(c => c.key === key);
  if (!card) throw new Error(`Unknown card: ${key}`);
  return card;
}
export function valueOf(player: Player, venture: Venture | null): number {
  const shared = venture && (venture.a === player.id || venture.b === player.id) ? venture.employees.reduce((n, e) => n + cardInfo(e.card.key).value, 0) : 0;
  return Math.max(0, player.subtotal + player.cards.reduce((n, c) => n + cardInfo(c.key).value, 0) + shared + player.penalties.reduce((a, b) => a + b, 0));
}
export function limitHand<T>(hand: T[], discardIndices: number[]): { hand: T[]; discarded: T[] } {
  const needed = Math.max(0, hand.length - catalog.handLimit);
  if (discardIndices.length !== needed || new Set(discardIndices).size !== needed || discardIndices.some(i => !Number.isInteger(i) || i < 0 || i >= hand.length)) throw new Error(`Choose exactly ${needed} cards to discard`);
  return { hand: hand.filter((_, i) => !discardIndices.includes(i)), discarded: hand.filter((_, i) => discardIndices.includes(i)) };
}
export function freshTable(scenario: Scenario): TableState {
  const setup = scenarios.find(s => s.key === scenario)!;
  const instance = (key: string, id: string): Instance => ({ key, id });
  const players: Player[] = [
    { id: 'neural', name: 'Neural AI', sector: 'AI / YOU', color: 'violet', subtotal: 625, cards: [instance('rockstar-cto', 'cto')], hand: [instance(scenario, 'action'), instance('viral-launch', 'your-launch'), instance('golden-handcuffs', 'your-defense'), instance('elite-engineer', 'your-engineer'), instance('founder-scandal', 'your-scandal')], penalties: [], skipNextTurn: false, skipped: false },
    { id: 'rocket', name: 'RocketWorks', sector: 'SPACE', color: 'coral', subtotal: 550, cards: [], hand: [], penalties: [], skipNextTurn: false, skipped: false },
    { id: 'flash', name: 'Flash Commerce', sector: 'CONSUMER', color: 'lime', subtotal: 305, cards: [instance('chief-scientist', 'scientist')], hand: [instance('ditch', 'their-ditch'), instance(setup.defense || 'golden-handcuffs', 'their-defense'), instance('investor', 'their-investor'), instance('patent-lawsuit', 'their-lawsuit'), instance('viral-launch', 'their-launch')], penalties: [], skipNextTurn: false, skipped: false },
    { id: 'fin', name: 'FinPay', sector: 'FINTECH', color: 'cyan', subtotal: 300, cards: [], hand: [], penalties: [], skipNextTurn: false, skipped: false },
  ];
  const state: TableState = { players, venture: null, revealedTo: null, revealedPlayer: null, discarded: [] };
  if (scenario === 'joint-venture' || scenario === 'ditch') {
    players[0].subtotal = 575; players[2].subtotal = 675;
    if (scenario === 'ditch') formVenture(state);
  }
  return state;
}
function formVenture(state: TableState) {
  const a = state.players[0], b = state.players[2];
  state.venture = { a: a.id, b: b.id, employees: [{ contributor: a.id, card: a.cards.splice(0, 1)[0] }, { contributor: b.id, card: b.cards.splice(0, 1)[0] }] };
}
function resolveDitch(state: TableState, defenderWins: boolean) {
  if (!state.venture) throw new Error('Ditch needs an active Joint Venture');
  state.players[defenderWins ? 2 : 0].cards.push(...state.venture.employees.map(e => e.card));
  state.venture = null;
}
/** Scripted mid-game examples, not a multiplayer game or a shuffled starting deal. */
export function resolveDemo(scenario: Scenario, stage: Stage, randomIndex = 0): TableState {
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
    case 'founder-scandal': state.revealedTo = actor.id; state.revealedPlayer = target.id; state.discarded.push(action); break;
    case 'joint-venture': formVenture(state); break;
    case 'ditch': resolveDitch(state, false); state.discarded.push(action); break;
    case 'patent-lawsuit': target.skipNextTurn = stage !== 'skipped'; target.skipped = stage === 'skipped'; if (stage === 'skipped') state.discarded.push(action); break;
    case 'pr-crisis': target.penalties.push(-75); break;
  }
  return state;
}
