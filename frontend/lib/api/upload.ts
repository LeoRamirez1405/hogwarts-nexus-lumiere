import { uploadFile } from "../core";

export const uploadApi = {
  uploadFile: (file: File) =>
    uploadFile<{ url: string; type: string; original_name: string }>(
      "/upload",
      file
    ),
};