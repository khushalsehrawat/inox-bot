import { NextRequest, NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/request";
import {
  requireWebAdmin,
  taxonomyErrorResponse,
  limitedBody,
} from "@/lib/web-admin";
import { withTaxonomy, invalidateWebCatalogue } from "@/lib/web-taxonomy";
import { TaxonomyError } from "@/lib/web-taxonomy-store.mjs";
export const runtime = "nodejs";
export async function GET() {
  try {
    await requireWebAdmin();
    return NextResponse.json(
      await withTaxonomy(async (store) => ({
        categories: await store.list(),
        assignments: await store.assignments(),
      })),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return taxonomyErrorResponse(error);
  }
}
export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req))
      throw new TaxonomyError(403, "Invalid request origin.");
    await requireWebAdmin();
    if (!req.headers.get("content-type")?.startsWith("application/json"))
      throw new TaxonomyError(415, "Use JSON.");
    let body;
    try {
      body = JSON.parse(
        Buffer.from(await limitedBody(req, 600000)).toString("utf8"),
      );
    } catch (error) {
      if (error instanceof TaxonomyError) throw error;
      throw new TaxonomyError(400, "Invalid JSON.");
    }
    if (!body || typeof body !== "object")
      throw new TaxonomyError(422, "Invalid category operation.");
    let transferred: number | undefined;
    await withTaxonomy(async (store) => {
      switch (body.operation) {
        case "transfer":
          if (typeof body.sourceId !== "string" || typeof body.destinationId !== "string")
            throw new TaxonomyError(422, "Choose source and destination categories.");
          transferred = await store.transfer(body.sourceId, body.destinationId);
          break;
        case "move":
          if (typeof body.id !== "string" || typeof body.direction !== "string" || !/^(up|down|(?:before|after):[^:]+)$/.test(body.direction) || !Number.isInteger(body.version))
            throw new TaxonomyError(422, "Select a category and move direction.");
          await store.move(body.id, body.direction, body.version);
          break;
        case "create":
          await store.create(body.category);
          break;
        case "update":
          if (typeof body.id !== "string")
            throw new TaxonomyError(422, "Select a category.");
          await store.update(body.id, body.category, body.version);
          break;
        case "delete":
          if (body.confirmed !== true || typeof body.id !== "string")
            throw new TaxonomyError(422, "Confirm category removal.");
          await store.remove(body.id, body.version);
          break;
        case "assign":
          if (
            typeof body.productId !== "string" ||
            typeof body.categoryId !== "string"
          )
            throw new TaxonomyError(422, "Select a product and category.");
          await store.assign(body.productId, body.categoryId);
          break;
        case "import":
          await store.import(body.rows);
          break;
        default:
          throw new TaxonomyError(422, "Unknown category operation.");
      }
    });
    invalidateWebCatalogue();
    return NextResponse.json(
      await withTaxonomy(async (store) => ({
        transferred,
        categories: await store.list(),
        assignments: await store.assignments(),
      })),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return taxonomyErrorResponse(error);
  }
}
