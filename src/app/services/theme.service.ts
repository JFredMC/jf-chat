import { Injectable, signal, effect, computed } from '@angular/core';
import { Theme } from '../types/theme';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly THEME_KEY = 'user-theme';
  
  // Señal privada para el estado del tema
  private readonly theme = signal<Theme>(this.getInitialTheme());
  
  // Señales públicas de solo lectura
  public readonly currentTheme = this.theme.asReadonly();
  public readonly isDarkMode = computed(() => this.theme() === 'dark');

  constructor() {
    // Efecto para aplicar el tema cuando cambia la señal
    effect(() => {
      this.applyTheme(this.theme());
    });

    // Escuchar cambios del sistema
    this.watchSystemTheme();
  }

  /**
   * Obtiene el tema inicial basado en localStorage o preferencia del sistema
   */
  private getInitialTheme(): Theme {
    if (typeof window === 'undefined') return 'light';
    
    const saved = localStorage.getItem(this.THEME_KEY) as Theme;
    if (saved) return saved;
    
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  /**
   * Alternar entre temas
   */
  public toggleTheme(): void {
    this.theme.update(current => current === 'dark' ? 'light' : 'dark');
  }

  /**
   * Establecer tema específico
   */
  public setTheme(theme: Theme): void {
    this.theme.set(theme);
  }

  /**
   * Aplicar el tema al documento
   */
  private applyTheme(theme: Theme): void {
    if (typeof window === 'undefined') return;

    // Guardar en localStorage
    localStorage.setItem(this.THEME_KEY, theme);
    
    // Aplicar clases al documento
    const html = document.documentElement;
    if (theme === 'dark') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
  }

  /**
   * Escuchar cambios en la preferencia del sistema
   */
  private watchSystemTheme(): void {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      // Solo cambiar si no hay preferencia guardada en localStorage
      const saved = localStorage.getItem(this.THEME_KEY);
      if (!saved) {
        this.theme.set(e.matches ? 'dark' : 'light');
      }
    };

    // Escuchar cambios (modern API)
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      // Fallback para navegadores antiguos
      mediaQuery.addListener(handleChange);
    }
  }

  /**
   * Obtener el tema actual como string (para uso en templates)
   */
  public getThemeName(): string {
    return this.theme();
  }

  /**
   * Resetear a la preferencia del sistema
   */
  public resetToSystem(): void {
    localStorage.removeItem(this.THEME_KEY);
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    this.theme.set(systemTheme);
  }
}