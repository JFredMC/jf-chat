import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';
import { IAttachment } from '../types/attachment.type';
import { UploadResponse } from '../types/storage.type';

@Injectable({
  providedIn: 'root'
})
export class AttachmentService {
  private readonly http = inject(HttpClient);
  private readonly configService = inject(ConfigService);
  private readonly urlApi = this.configService.getApiUrl('/attachment');

  // Subir múltiples archivos
  uploadFiles(files: File[], messageId?: number): Observable<IAttachment[]> {
    const formData = new FormData();
    
    files.forEach(file => {
      formData.append('files', file);
    });
    
    if (messageId) {
      formData.append('messageId', messageId.toString());
    }

    return this.http.post<IAttachment[]>(
      `${this.urlApi}/upload`,
      formData
    );
  }

  // Obtener attachments de un mensaje
  getMessageAttachments(messageId: number): Observable<IAttachment[]> {
    return this.http.get<IAttachment[]>(
      `${this.urlApi}/upload/message/${messageId}`
    );
  }

  // Eliminar attachment
  deleteAttachment(attachmentId: number): Observable<void> {
    return this.http.delete<void>(
      `${this.urlApi}/upload/${attachmentId}`
    );
  }

  // Vincular attachment a mensaje
  linkToMessage(attachmentId: number, messageId: number): Observable<IAttachment> {
    return this.http.post<IAttachment>(
      `${this.urlApi}/upload/${attachmentId}/link-to-message`,
      { messageId }
    );
  }

  uploadImages(files: File[], messageId?: number): Observable<IAttachment[]> {
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    return this.uploadFiles(imageFiles, messageId);
  }

  // Generar thumbnail URL (si tu backend lo soporta)
  generateThumbnailUrl(attachment: IAttachment, width: number = 200): string {
    if (!this.isImageAttachment(attachment)) {
      return attachment.file_url;
    }
    
    // Dependiendo de tu proveedor de storage, puedes generar URLs con parámetros de resize
    // Ejemplo para Cloudinary, Supabase Storage, etc.
    return `${attachment.file_url}?width=${width}&quality=80`;
  }

  // Verificar si es imagen
  isImageAttachment(attachment: IAttachment): boolean {
    return attachment.file_type?.startsWith('image/') || false;
  }

  // Obtener dimensiones de imagen (si es necesario)
  getImageDimensions(url: string): Promise<{width: number, height: number}> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = () => {
        resolve({ width: 0, height: 0 });
      };
      img.src = url;
    });
  }

  // Validaciones
  isValidFileType(file: File): boolean {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/zip', 'application/x-rar-compressed'
    ];
    return allowedTypes.includes(file.type);
  }

  isValidFileSize(file: File): boolean {
    const maxSize = 25 * 1024 * 1024; // 25MB
    return file.size <= maxSize;
  }

  getFileIcon(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    const iconMap: { [key: string]: string } = {
      'pdf': '📄',
      'doc': '📝', 'docx': '📝',
      'xls': '📊', 'xlsx': '📊',
      'txt': '📄',
      'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️', 'webp': '🖼️',
      'zip': '🗜️', 'rar': '🗜️',
    };
    
    return iconMap[extension || ''] || '📎';
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}