import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';

@Component({
  selector: 'app-not-found',
  templateUrl: './404.html',
  styleUrls: ['./404.scss']
})
export class NotFoundComponent {

  constructor(
    private router: Router,
    private location: Location
  ) {}

  goHome(): void {
    this.router.navigate(['/auth/login']);
  }

  goBack(): void {
    this.location.back();
  }
}