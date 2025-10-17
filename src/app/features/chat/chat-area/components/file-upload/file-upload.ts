import { Component, ElementRef, inject, input, output, signal, ViewChild } from "@angular/core";
import { AttachmentService } from "../../../../../services/attachment.service";
import { IAttachment } from "../../../../../types/attachment.type";

@Component({
  selector: 'app-file-upload',
  templateUrl: './file-upload.html',
  styleUrl: './file-upload.scss'
})
export class FileUpload {
  public readonly attachmentService = inject(AttachmentService);

  // Inputs
  public multiple = input<boolean>(true);
  public maxFiles = input<number>(10);
  public accept = input<string>('*/*');
  public disabled = input<boolean>(false);

  // Outputs
  public filesUploaded = output<IAttachment[]>();
  public uploadError = output<string>();
  public uploadStarted = output<void>();

  // Señales
  public isUploading = signal<boolean>(false);
  public uploadProgress = signal<number>(0);
  public selectedFiles = signal<File[]>([]);
  public uploadedAttachments = signal<IAttachment[]>([]);
  public dragOver = signal<boolean>(false);
  public imagePreviews = signal<{file: File, url: string}[]>([]);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  // Manejar selección de archivos
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processFiles(Array.from(input.files));
    }
  }

  // Manejar drag and drop
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    
    if (event.dataTransfer?.files) {
      this.processFiles(Array.from(event.dataTransfer.files));
    }
  }

  // Procesar archivos seleccionados
  private processFiles(files: File[]): void {
    const validFiles = files.slice(0, this.maxFiles()).filter(file => {
      const isValidType = this.attachmentService.isValidFileType(file);
      const isValidSize = this.attachmentService.isValidFileSize(file);

      if (!isValidType) {
        this.uploadError.emit(`Tipo de archivo no permitido: ${file.name}`);
        return false;
      }
      if (!isValidSize) {
        this.uploadError.emit(`Archivo demasiado grande: ${file.name} (máximo 25MB)`);
        return false;
      }

      return true;
    });

    if (validFiles.length > 0) {
      this.selectedFiles.set(validFiles);
      this.generateImagePreviews(validFiles);
    }

    // Limpiar input
    if (this.fileInput?.nativeElement) {
      this.fileInput.nativeElement.value = '';
    }
  }

  // Generar vistas previas para imágenes
  private generateImagePreviews(files: File[]): void {
    const previews: {file: File, url: string}[] = [];
    
    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        previews.push({ file, url });
      }
    });
    
    this.imagePreviews.set(previews);
  }

  // Subir archivos
  async uploadFiles(files: File[]): Promise<void> {
    if (files.length === 0) return;

    this.isUploading.set(true);
    this.uploadProgress.set(0);
    this.uploadStarted.emit();

    try {
      const response = await this.attachmentService.uploadFiles(files).toPromise();
      
      if (response) {
        this.uploadedAttachments.set(response);
        this.filesUploaded.emit(response);
        this.selectedFiles.set([]);
        this.imagePreviews.set([]); // Limpiar vistas previas
        this.uploadProgress.set(100);
      }
    } catch (error: any) {
      console.error('Error uploading files:', error);
      this.uploadError.emit(error.message || 'Error al subir archivos');
    } finally {
      setTimeout(() => {
        this.isUploading.set(false);
        this.uploadProgress.set(0);
      }, 1000);
    }
  }

  // Eliminar archivo seleccionado (antes de subir)
  removeSelectedFile(index: number): void {
    const files = this.selectedFiles();
    const previews = this.imagePreviews();
    
    // Revocar URL de la vista previa si existe
    const fileToRemove = files[index];
    if (fileToRemove.type.startsWith('image/')) {
      const previewIndex = previews.findIndex(p => p.file === fileToRemove);
      if (previewIndex !== -1) {
        URL.revokeObjectURL(previews[previewIndex].url);
        previews.splice(previewIndex, 1);
        this.imagePreviews.set([...previews]);
      }
    }
    
    this.selectedFiles.update(files => files.filter((_, i) => i !== index));
  }

  // Eliminar attachment subido
  removeUploadedAttachment(attachmentId: number): void {
    this.uploadedAttachments.update(attachments => 
      attachments.filter(att => att.id !== attachmentId)
    );
    
    // Opcional: Eliminar del servidor
    this.attachmentService.deleteAttachment(attachmentId).subscribe({
      error: (error) => console.error('Error deleting attachment:', error)
    });
  }

  // Abrir selector de archivos
  openFileSelector(): void {
    if (!this.disabled()) {
      this.fileInput.nativeElement.click();
    }
  }

  // Obtener información del archivo para mostrar
  getFileInfo(file: File): { icon: string; size: string; isImage: boolean } {
    return {
      icon: this.attachmentService.getFileIcon(file.name),
      size: this.attachmentService.formatFileSize(file.size),
      isImage: file.type.startsWith('image/')
    };
  }

  // Verificar si hay archivos en proceso
  hasFilesInProcess(): boolean {
    return this.selectedFiles().length > 0 || this.isUploading();
  }

  // Obtener vista previa de una imagen
  getImagePreview(file: File): string | null {
    const preview = this.imagePreviews().find(p => p.file === file);
    return preview ? preview.url : null;
  }

  // Limpiar URLs de vistas previas al destruir el componente
  ngOnDestroy(): void {
    this.imagePreviews().forEach(preview => {
      URL.revokeObjectURL(preview.url);
    });
  }
}