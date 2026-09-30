import { gameRequest } from '../../../lib/game-api';
export async function POST(request:Request){return gameRequest(request);}
