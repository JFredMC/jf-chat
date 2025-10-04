import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly THEME_KEY = 'user-theme';
  private darkMode = false;

  constructor() {
    // Verificar si estamos en navegador
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem(this.THEME_KEY);
      this.darkMode = savedTheme 
        ? savedTheme === 'dark'
        : window.matchMedia('(prefers-color-scheme: dark)').matches;
      
      this.applyTheme();
    }
  }

  toggleTheme() {
    this.darkMode = !this.darkMode;
    localStorage.setItem(this.THEME_KEY, this.darkMode ? 'dark' : 'light');
    this.applyTheme();
  }

  isDarkMode() {
    return this.darkMode;
  }

  private applyTheme() {
    if (typeof window !== 'undefined') {
      document.documentElement.classList.toggle('dark', this.darkMode);
    }
  }
}