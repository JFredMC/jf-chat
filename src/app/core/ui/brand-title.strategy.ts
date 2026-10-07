import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { BrandService } from './brand.service';

/** Route titles are bare ("Iniciar sesión"); the brand (Velo or Notas) is appended here. */
@Injectable()
export class BrandTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly brand = inject(BrandService);

  public override updateTitle(snapshot: RouterStateSnapshot): void {
    const page = this.buildTitle(snapshot);
    const name = this.brand.name();
    this.title.setTitle(page ? `${page} · ${name}` : name);
  }
}
