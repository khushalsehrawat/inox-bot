import type { CategoryInput } from "./web-taxonomy-model";
export class TaxonomyError extends Error {
  status: number;
  constructor(status: number, message: string);
}
export function validateCategory(input: unknown): CategoryInput;
