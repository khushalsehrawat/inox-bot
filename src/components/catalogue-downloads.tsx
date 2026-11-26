"use client";
import { useState } from "react";
import { Download, ArrowUpRight } from "lucide-react";
import { categories } from "@/lib/data";
import { Picture } from "./ui";
import { AnimatePresence, motion } from "motion/react";
import { editorialEase, useMotionPreferences } from "./motion-system";
export function CatalogueDownloads() {
  const [filter, setFilter] = useState("all");
  const { reduced } = useMotionPreferences();
  return (
    <>
      <div className="filter-tabs">
        <button
          className={filter === "all" ? "active" : ""}
          onClick={() => setFilter("all")}
        >
          All collections
          {filter === "all" && (
            <motion.span
              className="filter-active-line"
              layoutId="catalogue-filter"
              transition={{ duration: reduced ? 0 : 0.25, ease: editorialEase }}
            />
          )}
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            className={filter === c.id ? "active" : ""}
            onClick={() => setFilter(c.id)}
          >
            {c.short}
            {filter === c.id && (
              <motion.span
                className="filter-active-line"
                layoutId="catalogue-filter"
                transition={{
                  duration: reduced ? 0 : 0.25,
                  ease: editorialEase,
                }}
              />
            )}
          </button>
        ))}
      </div>
      <div className="download-grid">
        <AnimatePresence initial={false} mode="popLayout">
          {categories
            .filter((c) => filter === "all" || c.id === filter)
            .map((c) => (
              <motion.article
                key={c.id}
                layout="position"
                initial={reduced ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduced ? 0 : -6 }}
                transition={{
                  duration: reduced ? 0 : 0.3,
                  ease: editorialEase,
                }}
              >
                <Picture src={c.image} alt={`${c.name} collection preview`} />
                <span className="eyebrow">Collection overview</span>
                <h2>{c.name}</h2>
                <p>{c.description}</p>
                <a href="/media/collection.pdf" download className="text-link">
                  Download supplied <mark className="inox-word">INOX</mark> catalogue <Download size={17} />
                </a>
              </motion.article>
            ))}
        </AnimatePresence>
      </div>
      <p className="data-note">
        All collection links currently open the same legacy <mark className="inox-word">INOX</mark> PDF supplied in
        the existing repository. Current category-specific PDFs are pending.
      </p>
      <a className="text-link" href="/contact">
        Need technical documentation? Contact <mark className="inox-word">INOX</mark> <ArrowUpRight size={16} />
      </a>
    </>
  );
}
