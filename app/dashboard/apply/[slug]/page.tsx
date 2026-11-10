import { TrainingApplication } from "@/components/training-application";

export default async function WorkspaceApplication({ params }: { params: Promise<{ slug: string }> }) {
  return <TrainingApplication slug={(await params).slug} workspace />;
}
