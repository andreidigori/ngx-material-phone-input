import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatInputModule } from '@angular/material/input';
import { PhoneInputFlagDirective } from './phone-input-flag.directive';
import { PhoneInputComponent } from './phone-input.component';

@NgModule({
  declarations: [
    PhoneInputFlagDirective,
    PhoneInputComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatInputModule
  ],
  exports: [
    PhoneInputFlagDirective,
    PhoneInputComponent
  ]
})
export class PhoneInputModule { }
