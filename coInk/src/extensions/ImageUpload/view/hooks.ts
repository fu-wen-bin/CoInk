import { DragEvent, useEffect, useRef, useState } from 'react';
import { Editor } from '@tiptap/core';

import { toastError } from '@/utils/toast';
import {
  formatEditorImageMaxLabel,
  MAX_IMAGE_BYTES,
  uploadImageResumable,
  type UploadStatusPhase,
} from '@/lib/editor-image-upload';

export const useUploader = () => {
  const [loading, setLoading] = useState(false);

  const uploadFile = async (file: File) => {
    setLoading(true);

    try {
      const url = await uploadImageResumable(file);

      return url;
    } catch (errPayload: unknown) {
      const message =
        errPayload &&
        typeof errPayload === 'object' &&
        'response' in errPayload &&
        errPayload.response &&
        typeof errPayload.response === 'object' &&
        'data' in errPayload.response
          ? (errPayload.response as { data?: { error?: string; message?: string } }).data
              ?.message || (errPayload.response as { data?: { error?: string } }).data?.error
          : undefined;
      toastError(message || (errPayload instanceof Error ? errPayload.message : '图片上传失败'));
    } finally {
      setLoading(false);
    }
  };

  return { loading, uploadFile };
};

export const useFileUpload = () => {
  const fileInput = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInput.current?.click();
  };

  return { ref: fileInput, handleUploadClick };
};

export const useDropZone = ({ uploader }: { uploader: (file: File) => void }) => {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [draggedInside, setDraggedInside] = useState<boolean>(false);

  useEffect(() => {
    const dragStartHandler = () => {
      setIsDragging(true);
    };

    const dragEndHandler = () => {
      setIsDragging(false);
    };

    document.body.addEventListener('dragstart', dragStartHandler);
    document.body.addEventListener('dragend', dragEndHandler);

    return () => {
      document.body.removeEventListener('dragstart', dragStartHandler);
      document.body.removeEventListener('dragend', dragEndHandler);
    };
  }, []);

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); // 立即阻止默认行为
    e.stopPropagation();

    setDraggedInside(false);

    if (e.dataTransfer.files.length === 0) {
      return;
    }

    const fileList = e.dataTransfer.files;
    const files: File[] = [];

    for (let i = 0; i < fileList.length; i += 1) {
      const item = fileList.item(i);

      if (item) {
        files.push(item);
      }
    }

    if (files.some((file) => file.type.indexOf('image') === -1)) {
      return;
    }

    const filteredFiles = files.filter((f) => f.type.indexOf('image') !== -1);
    const file = filteredFiles.length > 0 ? filteredFiles[0] : undefined;

    if (file) {
      uploader(file);
    }
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const onDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggedInside(true);
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggedInside(false);
  };

  return { isDragging, draggedInside, onDragEnter, onDragLeave, onDragOver, onDrop };
};

export const useImgUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<UploadStatusPhase>('success');
  const [error, setError] = useState<Error | null>(null);

  // 封装上传函数
  const uploadImage = async (file: File, editor: Editor, pos: number | undefined) => {
    if (!file.type.startsWith('image/')) {
      throw new Error('请上传图片文件');
    }

    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error(`图片大小不能超过 ${formatEditorImageMaxLabel(MAX_IMAGE_BYTES)}`);
    }

    setIsUploading(true);
    setProgress(0);
    setPhase('uploading');
    setError(null);

    try {
      const imageUrl = await uploadImageResumable(file, {
        onProgress: ({ progress: nextProgress }) => setProgress(nextProgress),
        onStatus: ({ phase: nextPhase }) => setPhase(nextPhase),
      });

      let foundImageNode: boolean = false;
      editor.state.doc.descendants((node, currentPos) => {
        if (node.type.name === 'imageBlock' && currentPos === pos) {
          foundImageNode = true;
          return false;
        }
      });

      if (foundImageNode) {
        editor
          .chain()
          .deleteRange({ from: pos ?? 0, to: pos ?? 0 })
          .setImageBlock({ src: imageUrl })
          .focus()
          .run();
      }

      setProgress(100);
      setPhase('success');
      return imageUrl;
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error('图片上传失败');
      setError(normalized);
      setPhase('failed');
      toastError(normalized.message);
      throw normalized;
    } finally {
      setIsUploading(false);
    }
  };

  return {
    // 上传函数
    uploadImage,

    // 状态
    isUploading,
    isSuccess: phase === 'success',
    isError: phase === 'failed',
    progress,
    phase,

    // 数据和错误
    data: undefined as string | undefined,
    error,
  };
};
