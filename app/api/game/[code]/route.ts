import { gameRequest } from '../../../../lib/game-api';
type Context={params:Promise<{code:string}>};
export async function GET(request:Request,context:Context){return gameRequest(request,(await context.params).code);}
export async function POST(request:Request,context:Context){return gameRequest(request,(await context.params).code);}
