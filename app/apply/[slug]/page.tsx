import type { Metadata } from "next";
import { TrainingApplication } from "@/components/training-application";

export const metadata: Metadata = { title: "Training application", robots: { index: false, follow: false } };

export default async function Apply({ params }: { params: Promise<{ slug: string }> }) {
  return <TrainingApplication slug={(await params).slug} />;
}
