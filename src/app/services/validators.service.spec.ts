import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { ValidationService } from './validators.service';

describe('ValidationService', () => {
  it('requires upper case, lower case, a number and a symbol', () => {
    const validator = TestBed.inject(ValidationService).strongPasswordValidator();
    expect(validator(new FormControl('debil'))).toEqual({ strongPassword: true });
    expect(validator(new FormControl('Segura123!'))).toBeNull();
    expect(validator(new FormControl(''))).toBeNull();
  });
});
