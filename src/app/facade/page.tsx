import type { Metadata } from "next";
import { MaterialExperience } from "@/components/architectural-collections";

export const metadata: Metadata = { title: "Facade — Architectural expression", description: "Explore INOX Facade: architectural surfaces, texture and the interplay of light and shadow. Discuss your project with INOX." };
export default function FacadePage() { return <MaterialExperience type="facade" />; }
