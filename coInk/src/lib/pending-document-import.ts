'use client';

interface PendingDocumentImport {
  documentId: string;
  file: File;
  createdAt: number;
}

const PENDING_IMPORT_EXPIRE_MS = 3 * 60 * 1000;

let pendingDocumentImport: PendingDocumentImport | null = null;

export function setPendingDocumentImport(documentId: string, file: File): void {
  pendingDocumentImport = {
    documentId,
    file,
    createdAt: Date.now(),
  };
}

export function consumePendingDocumentImport(documentId: string): File | null {
  if (!pendingDocumentImport) return null;

  const isExpired = Date.now() - pendingDocumentImport.createdAt > PENDING_IMPORT_EXPIRE_MS;
  if (isExpired) {
    pendingDocumentImport = null;
    return null;
  }

  if (pendingDocumentImport.documentId !== documentId) {
    return null;
  }

  const file = pendingDocumentImport.file;
  pendingDocumentImport = null;
  return file;
}

export function clearPendingDocumentImport(): void {
  pendingDocumentImport = null;
}
