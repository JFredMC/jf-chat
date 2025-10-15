import { Injectable } from '@angular/core';
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

  public getWebSocketUrl(): string {
    const url = new URL(this.baseUrl);
    const host = url.host;
    
    if (this.isProduction()) {
      return `wss://${host}`;
    } else {
      return `ws://${host}`;
    }
  }
}