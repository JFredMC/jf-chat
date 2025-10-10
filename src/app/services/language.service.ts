import { Injectable, signal, effect } from '@angular/core';
import { Language } from '../types/language';

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  private readonly LANGUAGE_KEY = 'jfchat_language';
  
  // Señales
  private readonly currentLanguage = signal<Language>(this.getInitialLanguage());
  public readonly language = this.currentLanguage.asReadonly();

  constructor() {
    effect(() => {
      this.applyLanguage(this.currentLanguage());
    });
  }

  private getInitialLanguage(): Language {
    if (typeof window === 'undefined') return 'es';
    
    const saved = localStorage.getItem(this.LANGUAGE_KEY) as Language;
    if (saved) return saved;

    const browserLang = navigator.language.split('-')[0];
    return browserLang === 'es' || browserLang === 'en' ? browserLang as Language : 'es';
  }

  public setLanguage(lang: Language): void {
    this.currentLanguage.set(lang);
  }

  public toggleLanguage(): void {
    this.currentLanguage.update(current => current === 'es' ? 'en' : 'es');
  }

  private applyLanguage(lang: Language): void {
    if (typeof window === 'undefined') return;

    localStorage.setItem(this.LANGUAGE_KEY, lang);
    
    document.documentElement.lang = lang;
    
    console.log('Idioma cambiado a:', lang);
  }

  public getCurrentLanguage(): Language {
    return this.currentLanguage();
  }

  public getLanguageName(lang: Language): string {
    const names = {
      'es': 'Español',
      'en': 'English'
    };
    return names[lang];
  }

  public getLanguageFlag(lang: Language): string {
    const flags = {
      'es': '🇪🇸',
      'en': '🇺🇸'
    };
    return flags[lang];
  }
}