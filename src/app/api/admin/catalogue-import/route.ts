import { NextRequest, NextResponse } from 'next/server';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { requireWebAdmin, limitedBody, taxonomyErrorResponse } from '@/lib/web-admin';
import { isSameOrigin } from '@/lib/request';
import { withTaxonomy, invalidateWebCatalogue } from '@/lib/web-taxonomy';
import { prepareCatalogueImport } from '@/lib/catalogue-import.mjs';
import { TaxonomyError } from '@/lib/web-taxonomy-validation.mjs';
import { revalidatePath } from 'next/cache';
import { catalogueRows, catalogueCSV } from '@/lib/catalogue-csv.mjs';
import { isWithinCategory } from '@/lib/category-tree.mjs';
export const runtime='nodejs';
export async function GET(req:NextRequest) {
  try {
    await requireWebAdmin();
    if(req.nextUrl.searchParams.get('history') === 'true') {
      return NextResponse.json({history:await withTaxonomy(s=>s.uploadHistory())},{headers:{'Cache-Control':'private, no-store'}});
    }
    const category=req.nextUrl.searchParams.get('category');
    const csv=await withTaxonomy(async s=>{
      const categories=await s.list();
      const products=await s.productDrafts();
      return catalogueCSV(catalogueRows(products.filter(p=>!category || isWithinCategory(categories,p.subcategory || p.category,category))));
    });
    return new NextResponse(csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="inox-products.csv"','Cache-Control':'private, no-store'}});
  }catch(e){return taxonomyErrorResponse(e);}
}
// Preview confirmation is bound to the validated payload and expires after 15 minutes.
function signature(payload:unknown, expires:number) {
  const secret=process.env.WEB_ADMIN_SESSION_SECRET || process.env.WEB_IMPORT_SECRET;
  if (!secret || secret.length < 32) throw new TaxonomyError(503,'Set WEB_IMPORT_SECRET (at least 32 characters) to enable imports.');
  return createHmac('sha256',secret).update(`${expires}:${createHash('sha256').update(JSON.stringify(payload)).digest('hex')}`).digest('hex');
}
export async function POST(req:NextRequest) {
  try {
    if(!isSameOrigin(req)) throw new TaxonomyError(403,'Invalid request origin.');
    await requireWebAdmin();
    const body=JSON.parse(Buffer.from(await limitedBody(req,2000000)).toString());
    if(body.operation === 'preview') {
      const products=await withTaxonomy(async s => prepareCatalogueImport(body.rows,await s.list(),await s.productDrafts()));
      const expires=Date.now()+900000;
      return NextResponse.json({products,expires,token:signature(products,expires)},{headers:{'Cache-Control':'private, no-store'}});
    }
    const expected=signature(body.products,body.expires), token=String(body.token || '');
    if(body.operation !== 'confirm' || !Number.isFinite(body.expires) || body.expires < Date.now() || body.expires > Date.now()+900000 || token.length !== expected.length || !timingSafeEqual(Buffer.from(token),Buffer.from(expected))) throw new TaxonomyError(422,'Preview expired or changed. Preview again.');
    await withTaxonomy(s=>s.saveProducts(body.products));
    invalidateWebCatalogue();
    revalidatePath('/products');
    revalidatePath('/sitemap.xml');
    for(const p of body.products) revalidatePath(`/products/${p.id}`);
    return NextResponse.json({count:body.products.length},{headers:{'Cache-Control':'no-store'}});
  }catch(e){return taxonomyErrorResponse(e);}
}
