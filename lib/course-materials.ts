export const MATERIAL_BUCKET = "course-materials";
export const MATERIAL_LIMIT = 20 * 1024 * 1024;
export const MATERIAL_TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
} as const;

export function materialExtension(name: string) {
  const extension = name.split(".").at(-1)?.toLowerCase();
  return extension && Object.hasOwn(MATERIAL_TYPES, extension) ? extension as keyof typeof MATERIAL_TYPES : null;
}
