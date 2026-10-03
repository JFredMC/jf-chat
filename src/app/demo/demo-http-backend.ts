import { HttpBackend, HttpErrorResponse, HttpEventType, HttpHeaders, HttpResponse, HttpXhrBackend, type HttpEvent, type HttpRequest } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../core/config';
import { DemoHttpError, DemoServer, type DemoFile } from './demo-server';

/** Files up to this size are stored as data URLs (they survive a reload). */
const PERSIST_LIMIT = 1024 * 1024;
const UPLOAD_PATH = /^\/conversation\/(\d+)\/attachments$/;

const readAsDataUrl = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

/**
 * Replaces the network for API calls: requests are answered by the
 * in-browser DemoServer with a small, realistic latency.
 */
@Injectable()
export class DemoHttpBackend implements HttpBackend {
  private readonly server = inject(DemoServer);
  private readonly api = inject(API_URL);
  private readonly network = inject(HttpXhrBackend);

  public handle(request: HttpRequest<unknown>): Observable<HttpEvent<unknown>> {
    if (!request.url.startsWith(this.api)) return this.network.handle(request);
    const path = request.url.slice(this.api.length).split('?')[0] || '/';
    const token = request.headers.get('Authorization')?.replace(/^Bearer /, '') ?? null;
    const query = new URLSearchParams(request.urlWithParams.split('?')[1] ?? '');

    return new Observable<HttpEvent<unknown>>((observer) => {
      let cancelled = false;
      const timers: ReturnType<typeof setTimeout>[] = [];
      const wait = (ms: number) => new Promise<void>((resolve) => timers.push(setTimeout(resolve, ms * this.server.speed)));
      observer.next({ type: HttpEventType.Sent });

      const run = async () => {
        const upload = UPLOAD_PATH.exec(path);
        if (upload && request.method === 'POST' && request.body instanceof FormData) {
          const file = request.body.get('file');
          if (!(file instanceof File)) throw new DemoHttpError(400, 'Falta el archivo');
          // Simulated progress so the UI looks like a real upload.
          for (const loaded of [0.25, 0.6, 1]) {
            await wait(150);
            if (cancelled) return null;
            observer.next({ type: HttpEventType.UploadProgress, loaded: Math.round(file.size * loaded), total: file.size });
          }
          const persistable = file.size <= PERSIST_LIMIT;
          const demoFile: DemoFile = {
            name: file.name,
            type: file.type,
            size: file.size,
            url: persistable ? await readAsDataUrl(file) : URL.createObjectURL(file),
            persistable,
          };
          return { status: 201, body: this.server.upload(token, Number(upload[1]), demoFile) };
        }
        await wait(120 + Math.random() * 180);
        if (cancelled) return null;
        return this.server.handle({ method: request.method, path, query, body: request.body, token });
      };

      run()
        .then((response) => {
          if (!response || cancelled) return;
          observer.next(
            new HttpResponse({
              status: response.status,
              statusText: 'OK',
              body: response.body,
              url: request.url,
              headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
            }),
          );
          observer.complete();
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          const status = error instanceof DemoHttpError ? error.status : 500;
          const message = error instanceof Error ? error.message : 'Error del servidor de demo';
          observer.error(
            new HttpErrorResponse({ status, statusText: 'Error', url: request.url, error: { statusCode: status, message } }),
          );
        });

      return () => {
        cancelled = true;
        timers.forEach(clearTimeout);
      };
    });
  }
}
