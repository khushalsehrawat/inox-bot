import { NextRequest } from "next/server";
import { askEnabled, askFailure, askJson, handleAsk } from "@/lib/ask-inox-server";
export const runtime = "nodejs";
export async function GET() {return askJson({enabled:askEnabled()});}
export async function POST(req:NextRequest) {
  try {return await handleAsk(req);} catch(error) {return askFailure(error);}
}
