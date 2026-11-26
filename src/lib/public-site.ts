import "server-only";
import { cache } from "react";
import { getPublicWebCategories } from "./web-taxonomy";
import { publicRead } from "./public-read";
export const publicCategories = cache(()=>publicRead(getPublicWebCategories,[]));
