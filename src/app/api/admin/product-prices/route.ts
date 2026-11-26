import { NextRequest, NextResponse } from 'next/server';
import { requireWebAdmin, limitedBody, taxonomyErrorResponse } from '@/lib/web-admin';
import { isSameOrigin } from '@/lib/request';
import { variationPrices, savePrices, priceHistory } from '@/lib/website-pricing';
import { TaxonomyError } from '@/lib/web-taxonomy-validation.mjs';
const headers = { 'Cache-Control':'private, no-store' };
export async function GET() {
  try { await requireWebAdmin(); return NextResponse.json({prices:await variationPrices(), history:await priceHistory()}, {headers}); } catch(e) { return taxonomyErrorResponse(e); }
}
export async function PUT(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) throw new TaxonomyError(403,'Invalid request origin.');
    await requireWebAdmin();
    const body=JSON.parse(Buffer.from(await limitedBody(req,128000)).toString());
    return NextResponse.json({prices:await savePrices(body.changes),history:await priceHistory()},{headers});
  } catch(e) { return taxonomyErrorResponse(e); }
}
