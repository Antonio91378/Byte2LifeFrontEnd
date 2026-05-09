import { resolveAssetUrl } from "@/utils/api";

export const SALE_ATTACHMENT_CATEGORIES = {
  PRODUCT_IMAGE: "product-image",
  COMPLEMENTARY_IMAGE: "complementary-image",
  COMPLEMENTARY_FILE: "complementary-file",
} as const;

export type SaleAttachmentCategory =
  (typeof SALE_ATTACHMENT_CATEGORIES)[keyof typeof SALE_ATTACHMENT_CATEGORIES];

export interface SaleAttachment {
  storageId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  category: SaleAttachmentCategory;
  uploadedAt: string;
}

export interface PendingSaleAttachment {
  localId: string;
  file: File;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  category: SaleAttachmentCategory;
  previewUrl?: string;
}

export interface SaleAttachmentListItem {
  key: string;
  name: string;
  contentType: string;
  sizeBytes: number;
  category: SaleAttachmentCategory;
  url: string;
  isPending: boolean;
  localId?: string;
  storageId?: string;
}

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1600;
const IMAGE_OUTPUT_QUALITY = 0.82;

const ALLOWED_FILE_EXTENSIONS = new Set([
  ".3mf",
  ".stl",
  ".obj",
  ".zip",
  ".pdf",
  ".txt",
  ".csv",
  ".json",
  ".md",
]);

export function isImageCategory(category: SaleAttachmentCategory) {
  return (
    category === SALE_ATTACHMENT_CATEGORIES.PRODUCT_IMAGE ||
    category === SALE_ATTACHMENT_CATEGORIES.COMPLEMENTARY_IMAGE
  );
}

export function formatBytes(sizeBytes: number) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function getSaleAttachmentUrl(storageId: string) {
  return resolveAssetUrl(`/api/sales/files/${storageId}`);
}

export function getAttachmentsByCategory(
  attachments: SaleAttachment[] | undefined,
  category: SaleAttachmentCategory,
) {
  return (attachments || []).filter(
    (attachment) => attachment.category === category,
  );
}

export function getFirstProductImageUrl(attachments?: SaleAttachment[]) {
  const firstProductImage = getAttachmentsByCategory(
    attachments,
    SALE_ATTACHMENT_CATEGORIES.PRODUCT_IMAGE,
  )[0];

  return firstProductImage
    ? getSaleAttachmentUrl(firstProductImage.storageId)
    : "";
}

export function toAttachmentListItems(
  existingAttachments: SaleAttachment[],
  pendingAttachments: PendingSaleAttachment[],
  category: SaleAttachmentCategory,
) {
  const existingItems: SaleAttachmentListItem[] = existingAttachments
    .filter((attachment) => attachment.category === category)
    .map((attachment) => ({
      key: attachment.storageId,
      name: attachment.fileName,
      contentType: attachment.contentType,
      sizeBytes: attachment.sizeBytes,
      category: attachment.category,
      url: getSaleAttachmentUrl(attachment.storageId),
      isPending: false,
      storageId: attachment.storageId,
    }));

  const pendingItems: SaleAttachmentListItem[] = pendingAttachments
    .filter((attachment) => attachment.category === category)
    .map((attachment) => ({
      key: attachment.localId,
      name: attachment.fileName,
      contentType: attachment.contentType,
      sizeBytes: attachment.sizeBytes,
      category: attachment.category,
      url: attachment.previewUrl || "",
      isPending: true,
      localId: attachment.localId,
    }));

  return [...existingItems, ...pendingItems];
}

export async function buildPendingSaleAttachments(
  files: File[],
  category: SaleAttachmentCategory,
) {
  const pendingAttachments: PendingSaleAttachment[] = [];

  for (const file of files) {
    const preparedFile = isImageCategory(category)
      ? await prepareImageFile(file)
      : file;

    validateFileForCategory(preparedFile, category);

    pendingAttachments.push({
      localId: createLocalId(),
      file: preparedFile,
      fileName: preparedFile.name,
      contentType: preparedFile.type || "application/octet-stream",
      sizeBytes: preparedFile.size,
      category,
      previewUrl: isImageCategory(category)
        ? URL.createObjectURL(preparedFile)
        : undefined,
    });
  }

  return pendingAttachments;
}

export function appendPendingAttachmentsToFormData(
  formData: FormData,
  attachments: PendingSaleAttachment[],
) {
  attachments.forEach((attachment) => {
    formData.append(
      getFieldNameForCategory(attachment.category),
      attachment.file,
    );
  });
}

export function revokePendingSaleAttachmentPreview(
  attachment: PendingSaleAttachment,
) {
  if (attachment.previewUrl) {
    URL.revokeObjectURL(attachment.previewUrl);
  }
}

export function revokePendingSaleAttachmentPreviews(
  attachments: PendingSaleAttachment[],
) {
  attachments.forEach(revokePendingSaleAttachmentPreview);
}

function getFieldNameForCategory(category: SaleAttachmentCategory) {
  if (category === SALE_ATTACHMENT_CATEGORIES.PRODUCT_IMAGE) {
    return "productImages";
  }

  if (category === SALE_ATTACHMENT_CATEGORIES.COMPLEMENTARY_IMAGE) {
    return "complementaryImages";
  }

  return "complementaryFiles";
}

function createLocalId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function validateFileForCategory(file: File, category: SaleAttachmentCategory) {
  if (isImageCategory(category)) {
    if (!file.type.startsWith("image/")) {
      throw new Error("Essa categoria aceita apenas imagens.");
    }

    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error("As imagens precisam ter no máximo 2 MB após o preparo.");
    }

    return;
  }

  const extension = getFileExtension(file.name);
  if (!ALLOWED_FILE_EXTENSIONS.has(extension)) {
    throw new Error("Formato de arquivo complementar não suportado.");
  }

  if (file.size > MAX_FILE_BYTES) {
    throw new Error("Arquivos complementares precisam ter no máximo 8 MB.");
  }
}

async function prepareImageFile(file: File) {
  if (!file.type.startsWith("image/")) {
    return file;
  }

  if (file.type === "image/gif") {
    return file;
  }

  const image = await loadImage(file);
  const largestSide = Math.max(image.width, image.height);
  const resizeRatio =
    largestSide > MAX_IMAGE_DIMENSION ? MAX_IMAGE_DIMENSION / largestSide : 1;

  if (resizeRatio === 1 && file.size <= MAX_IMAGE_BYTES) {
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * resizeRatio));
  canvas.height = Math.max(1, Math.round(image.height * resizeRatio));

  const context = canvas.getContext("2d");
  if (!context) {
    return file;
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const outputType = resolveImageOutputType(file.type);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(
      (result) => resolve(result),
      outputType,
      outputType === "image/png" ? undefined : IMAGE_OUTPUT_QUALITY,
    );
  });

  if (!blob) {
    return file;
  }

  const nextExtension = getExtensionForMimeType(outputType);
  const nextName = replaceFileExtension(file.name, nextExtension);

  return new File([blob], nextName, {
    type: outputType,
    lastModified: file.lastModified,
  });
}

function resolveImageOutputType(contentType: string) {
  if (contentType === "image/png" || contentType === "image/webp") {
    return contentType;
  }

  return "image/jpeg";
}

function replaceFileExtension(fileName: string, extension: string) {
  const lastDotIndex = fileName.lastIndexOf(".");
  if (lastDotIndex === -1) {
    return `${fileName}${extension}`;
  }

  return `${fileName.slice(0, lastDotIndex)}${extension}`;
}

function getExtensionForMimeType(contentType: string) {
  if (contentType === "image/png") {
    return ".png";
  }

  if (contentType === "image/webp") {
    return ".webp";
  }

  return ".jpg";
}

function getFileExtension(fileName: string) {
  const lastDotIndex = fileName.lastIndexOf(".");
  if (lastDotIndex === -1) {
    return "";
  }

  return fileName.slice(lastDotIndex).toLowerCase();
}

async function loadImage(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () =>
        reject(new Error("Não foi possível processar a imagem."));
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
