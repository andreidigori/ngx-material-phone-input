import { Directive, TemplateRef } from '@angular/core';

@Directive({
  selector: 'ng-template[matxPhoneInputFlag]'
})
export class PhoneInputFlagDirective {

  constructor(
    public _templateRef: TemplateRef<void>
  ) { }

}
