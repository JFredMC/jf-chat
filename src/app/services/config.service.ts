// config.service.ts
import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private readonly baseUrl = environment.apiUrl;

  public getApiUrl(endpoint: string): string {
    return `${this.baseUrl}${endpoint}`;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public isProduction(): boolean {
    return environment.production;
  }
}