"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import type { WebCategory } from "@/lib/web-taxonomy-model";
const TaxonomyContext = createContext<{
  categories: WebCategory[];
  refresh: () => Promise<void>;
}>({ categories: [], refresh: async () => {} });
export function WebTaxonomyProvider({
  initialCategories,
  children,
}: {
  initialCategories: WebCategory[];
  children: React.ReactNode;
}) {
  const [categories, setCategories] = useState(initialCategories);
  useEffect(() => { setCategories(initialCategories); }, [initialCategories]);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/web/categories", {
        cache: "no-store",
      });
      const body = await response.json();
      if (response.ok && Array.isArray(body.categories))
        setCategories(body.categories);
    } catch {}
  }, []);
  useEffect(() => {
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);
  return (
    <TaxonomyContext.Provider value={{ categories, refresh }}>
      {children}
    </TaxonomyContext.Provider>
  );
}
export function useWebTaxonomy() {
  return useContext(TaxonomyContext);
}
