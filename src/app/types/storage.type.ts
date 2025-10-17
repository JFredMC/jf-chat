export interface UploadResponse {
  message: string;
  path: string;
  id: string;
}

export interface FileInfo {
  name: string;
  id: string;
  updated_at: string;
  created_at: string;
  last_accessed_at: string;
  metadata: Record<string, any>;
}