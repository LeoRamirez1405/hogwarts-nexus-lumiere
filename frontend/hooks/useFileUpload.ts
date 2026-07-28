"use client";

import { useState } from "react";
import { api } from "@/lib/api";

interface UploadResult {
  url: string;
  type: string;
  original_name: string;
}

interface UseFileUploadOptions {
  onSuccess?: (result: UploadResult) => void;
  onError?: (error: Error) => void;
}

export function useFileUpload(options: UseFileUploadOptions = {}) {
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File): Promise<UploadResult | null> => {
    setUploading(true);
    try {
      const result = await api.uploadFile(file);
      options.onSuccess?.(result);
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Upload failed");
      options.onError?.(err);
      return null;
    } finally {
      setUploading(false);
    }
  };

  return { upload, uploading };
}

export function useImageUpload(options: UseFileUploadOptions = {}) {
  const { upload, uploading } = useFileUpload(options);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const result = await upload(file);
    e.target.value = "";
    return result;
  };

  return { handleFileSelect, uploading };
}