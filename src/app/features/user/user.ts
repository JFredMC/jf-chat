import { Component, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-user',
  imports: [],
  templateUrl: './user.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './user.scss'
})
export class User {

}
