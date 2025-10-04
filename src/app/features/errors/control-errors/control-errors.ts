// 3. Create a Reusable Error Display Component
import { Component, Input, OnInit, OnDestroy, Inject, signal, inject } from '@angular/core';
import { FormGroupDirective, ValidationErrors } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ValidationService } from '../../../services/validators.service';

@Component({
  selector: 'app-control-error',
  templateUrl: './control-errors.html',
})
export class ControlErrors implements OnInit, OnDestroy {
  private formGroupDirective = inject(FormGroupDirective);
  private validationService = inject(ValidationService);
  private subscription: Subscription = new Subscription();

  @Input() controlName!: string;

  errorMessage: string | null = null;

  ngOnInit() {
    const control = this.formGroupDirective.control.get(this.controlName);

    if (control) {
      // Suscribirse a cambios de valor y estado
      this.subscription.add(
        control.statusChanges.subscribe(() => {
          this.updateErrorMessage(control);
        })
      );

      this.subscription.add(
        control.valueChanges.subscribe(() => {
          this.updateErrorMessage(control);
        })
      );

      // Validación inicial
      this.updateErrorMessage(control);
    }
  }

  private updateErrorMessage(control: any) {
    if (control.invalid && (control.dirty || control.touched)) {
      const errors: ValidationErrors = control.errors;
      const firstKey = Object.keys(errors)[0];
      this.errorMessage = this.validationService.getErrorMessage(firstKey, errors[firstKey]);
    } else {
      this.errorMessage = null;
    }
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
}