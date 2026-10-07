import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, input, signal, viewChild } from '@angular/core';
import { AuthStore } from '../../core/auth/auth.store';
import type { Attachment } from '../../core/models';
import { ToastService } from '../../core/ui/toast.service';
import { ChatApi } from './chat.api';

/** Text stamped over every photo or video: who is looking, and when. */
export function watermarkText(username: string, at: Date): string {
  const two = (n: number) => String(n).padStart(2, '0');
  return `@${username} · ${two(at.getDate())}/${two(at.getMonth() + 1)} ${two(at.getHours())}:${two(at.getMinutes())}`;
}

/** Fits a w×h image inside a box, never upscaling. */
export function fitInside(w: number, h: number, boxW: number, boxH: number): { width: number; height: number } {
  const scale = Math.min(1, boxW / w, boxH / h);
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

/** Diagonal, repeated watermark drawn on a canvas context. */
export function drawWatermark(ctx: CanvasRenderingContext2D, width: number, height: number, text: string, ratio = 1): void {
  ctx.save();
  ctx.font = `600 ${Math.round(15 * ratio)}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = Math.max(1, ratio);
  ctx.translate(width / 2, height / 2);
  ctx.rotate(-Math.PI / 7);
  const stepX = ctx.measureText(text).width + 60 * ratio;
  const stepY = 70 * ratio;
  const reach = Math.hypot(width, height);
  for (let y = -reach; y < reach; y += stepY) {
    const offset = (Math.round(y / stepY) % 2) * (stepX / 2);
    for (let x = -reach; x < reach; x += stepX) {
      ctx.strokeText(text, x + offset, y);
      ctx.fillText(text, x + offset, y);
    }
  }
  ctx.restore();
}

const URL_MARGIN_MS = 5_000;

/**
 * Photos and videos are never shown inline nor downloadable: the user holds
 * the tile to see them full screen, drawn on a canvas (images) or played
 * without controls (videos), with the viewer's username stamped on top.
 * Releasing hides them and drops the pixels. The short-lived signed URL is
 * only requested while holding.
 */
@Component({
  selector: 'app-secure-media',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block secure-media',
    '(contextmenu)': '$event.preventDefault()',
    '(dragstart)': '$event.preventDefault()',
  },
  template: `
    @if (!isMedia()) {
      <p class="flex items-center gap-2 rounded-xl bg-black/10 px-3 py-2 text-xs dark:bg-white/10" data-testid="legacy-file">
        <span aria-hidden="true">📄</span> Archivo de una versión anterior (Velo solo muestra fotos y videos)
      </p>
    } @else {
    <div
      role="button"
      tabindex="0"
      class="relative flex h-36 w-56 max-w-full touch-none flex-col items-center justify-center gap-1 overflow-hidden rounded-xl bg-gradient-to-br from-slate-700 via-slate-800 to-indigo-900 text-white select-none"
      [attr.aria-label]="label() + '. Mantén pulsado para ver'"
      (pointerdown)="hold($event)"
      (keydown.space)="keyHold($event)"
      (keydown.enter)="keyHold($event)"
      (keyup.space)="release()"
      (keyup.enter)="release()"
      data-testid="secure-media"
    >
      <span class="absolute inset-0 opacity-40 [background:radial-gradient(circle_at_30%_30%,#22d3ee55,transparent_60%),radial-gradient(circle_at_70%_70%,#818cf855,transparent_55%)]" aria-hidden="true"></span>
      <span class="relative text-2xl" aria-hidden="true">{{ isVideo() ? '🎬' : '📷' }}</span>
      <span class="relative text-sm font-semibold">{{ label() }}</span>
      <span class="relative text-[0.7rem] opacity-80">{{ loading() ? 'Abriendo…' : 'Mantén pulsado para ver' }}</span>
    </div>

    @if (open()) {
      <div class="fixed inset-0 z-[70] flex items-center justify-center bg-black select-none" data-testid="media-viewer" aria-live="polite" (contextmenu)="$event.preventDefault()">
        @if (isVideo()) {
          <video
            #video
            class="pointer-events-none max-h-full max-w-full"
            playsinline
            autoplay
            disablepictureinpicture
            disableremoteplayback
            controlslist="nodownload noplaybackrate noremoteplayback nofullscreen"
            [src]="url() ?? ''"
            (loadeddata)="loading.set(false)"
            data-testid="media-video"
          ></video>
          <canvas #mark class="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true"></canvas>
        } @else {
          <canvas #canvas class="pointer-events-none max-h-full max-w-full" data-testid="media-canvas" [attr.aria-label]="attachment().file_name"></canvas>
        }
        @if (loading()) {
          <span class="absolute text-sm text-white/70">Abriendo…</span>
        }
        <span class="absolute inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] text-center text-xs text-white/60">Suelta para ocultar</span>
      </div>
    }
    }
  `,
})
export class SecureMediaComponent {
  private readonly api = inject(ChatApi);
  private readonly auth = inject(AuthStore);
  private readonly toast = inject(ToastService);
  private readonly document = inject(DOCUMENT);
  public readonly attachment = input.required<Attachment>();

  protected readonly isVideo = computed(() => !!this.attachment().is_video || this.attachment().file_type.startsWith('video/'));
  protected readonly isMedia = computed(() => this.isVideo() || this.attachment().is_image);
  protected readonly label = computed(() => (this.isVideo() ? 'Video' : 'Foto'));
  protected readonly open = signal(false);
  protected readonly loading = signal(false);
  protected readonly url = signal<string | null>(null);
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly mark = viewChild<ElementRef<HTMLCanvasElement>>('mark');
  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');
  private signed: { url: string; until: number } | null = null;
  private session = 0;
  private readonly stop = () => this.release();

  public constructor() {
    inject(DestroyRef).onDestroy(() => this.release());
  }

  protected hold(event: PointerEvent): void {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    event.preventDefault();
    event.stopPropagation();
    this.show();
  }

  protected keyHold(event: Event): void {
    event.preventDefault();
    if (!this.open()) this.show();
  }

  public release(): void {
    const view = this.document.defaultView;
    view?.removeEventListener('pointerup', this.stop);
    view?.removeEventListener('pointercancel', this.stop);
    view?.removeEventListener('blur', this.stop);
    if (!this.open()) return;
    this.session++;
    const video = this.video()?.nativeElement;
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    const canvas = this.canvas()?.nativeElement;
    if (canvas) canvas.width = canvas.height = 0;
    this.url.set(null);
    this.loading.set(false);
    this.open.set(false);
  }

  private show(): void {
    const view = this.document.defaultView;
    view?.addEventListener('pointerup', this.stop);
    view?.addEventListener('pointercancel', this.stop);
    view?.addEventListener('blur', this.stop);
    const session = ++this.session;
    this.open.set(true);
    this.loading.set(true);
    void this.signedUrl().then(
      (url) => {
        if (session !== this.session) return;
        if (this.isVideo()) {
          this.url.set(url);
          queueMicrotask(() => this.stampVideo());
        } else {
          this.paint(url, session);
        }
      },
      () => {
        if (session !== this.session) return;
        this.release();
        this.toast.error('No se pudo abrir');
      },
    );
  }

  private signedUrl(): Promise<string> {
    if (this.signed && this.signed.until > Date.now()) return Promise.resolve(this.signed.url);
    return new Promise((resolve, reject) =>
      this.api.attachmentUrl(this.attachment().id).subscribe({
        next: ({ url, expiresIn }) => {
          this.signed = { url, until: Date.now() + expiresIn * 1000 - URL_MARGIN_MS };
          resolve(url);
        },
        error: reject,
      }),
    );
  }

  private paint(url: string, session: number): void {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      const canvas = this.canvas()?.nativeElement;
      if (session !== this.session || !canvas) return;
      const ratio = this.document.defaultView?.devicePixelRatio ?? 1;
      const view = this.document.defaultView;
      const box = fitInside(image.naturalWidth, image.naturalHeight, (view?.innerWidth ?? 800) * ratio, (view?.innerHeight ?? 600) * ratio);
      canvas.width = box.width;
      canvas.height = box.height;
      canvas.style.width = `${box.width / ratio}px`;
      canvas.style.height = `${box.height / ratio}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(image, 0, 0, box.width, box.height);
      drawWatermark(ctx, box.width, box.height, this.stamp(), ratio);
      image.src = '';
      this.loading.set(false);
    };
    image.onerror = () => {
      if (session !== this.session) return;
      this.release();
      this.toast.error('No se pudo abrir');
    };
    image.src = url;
  }

  private stampVideo(): void {
    const canvas = this.mark()?.nativeElement;
    if (!canvas) return;
    const ratio = this.document.defaultView?.devicePixelRatio ?? 1;
    canvas.width = canvas.clientWidth * ratio;
    canvas.height = canvas.clientHeight * ratio;
    const ctx = canvas.getContext('2d');
    if (ctx) drawWatermark(ctx, canvas.width, canvas.height, this.stamp(), ratio);
  }

  private stamp(): string {
    return watermarkText(this.auth.user()?.username ?? 'velo', new Date());
  }
}
