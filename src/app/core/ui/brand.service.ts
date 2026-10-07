import { DOCUMENT, Injectable, computed, inject, signal } from '@angular/core';

const DISGUISE_KEY = 'velo.disguise';

/** Identity the app shows to anyone glancing at the screen or the home screen. */
export interface BrandIdentity {
  name: string;
  icon: string;
  appleIcon: string;
  manifest: string;
}

export const VELO: BrandIdentity = {
  name: 'Velo',
  icon: 'favicon.ico',
  appleIcon: 'icons/velo-180.png',
  manifest: 'manifest.webmanifest',
};

/** Generic, boring identity: the tab and the installed icon read "Notas". */
export const DISGUISE: BrandIdentity = {
  name: 'Notas',
  icon: 'icons/notas.ico',
  appleIcon: 'icons/notas-180.png',
  manifest: 'manifest-discreto.webmanifest',
};

/**
 * Owns the visible identity (name, favicon, manifest). public/boot.js applies
 * the same choice before the first paint so nothing flashes on load.
 */
@Injectable({ providedIn: 'root' })
export class BrandService {
  private readonly document = inject(DOCUMENT);
  public readonly disguised = signal(readDisguise());
  public readonly identity = computed(() => (this.disguised() ? DISGUISE : VELO));
  public readonly name = computed(() => this.identity().name);

  public setDisguised(on: boolean): void {
    this.disguised.set(on);
    try {
      if (on) localStorage.setItem(DISGUISE_KEY, '1');
      else localStorage.removeItem(DISGUISE_KEY);
    } catch {
      /* private mode */
    }
    this.apply();
  }

  /** Swaps favicon, touch icon and manifest to match the current identity. */
  public apply(): void {
    const identity = this.identity();
    const head = this.document.head;
    head.querySelector('link[rel="icon"]')?.setAttribute('href', identity.icon);
    head.querySelector('link[rel="apple-touch-icon"]')?.setAttribute('href', identity.appleIcon);
    head.querySelector('link[rel="manifest"]')?.setAttribute('href', identity.manifest);
    head.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', identity.name);
  }
}

function readDisguise(): boolean {
  try {
    return localStorage.getItem(DISGUISE_KEY) === '1';
  } catch {
    return false;
  }
}
