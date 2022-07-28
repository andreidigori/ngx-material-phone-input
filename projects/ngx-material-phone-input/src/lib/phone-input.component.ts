import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ContentChild, DoCheck, ElementRef, Inject, Input, NgZone, OnChanges, OnDestroy, OnInit, Optional, Self, SimpleChanges, ViewChild, ViewEncapsulation } from '@angular/core';
import { AbstractControl, ControlValueAccessor, FormControl, FormGroupDirective, NgControl, NgForm, UntypedFormControl, Validator, Validators } from '@angular/forms';
import { CanUpdateErrorState, ErrorStateMatcher, MatOption } from '@angular/material/core';
import { MatFormField, MatFormFieldControl, MAT_FORM_FIELD } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { debounceTime, distinctUntilChanged, filter, map, startWith, Subject, Subscription, take } from 'rxjs';
import { Country } from './phone-input.interfaces';
import { PhoneInputFlagDirective } from './phone-input-flag.directive';
import { COUNTRIES } from './phone-input-countries';

let nextUniqueId = 0;

@Component({
  selector: 'matx-phone-input',
  templateUrl: './phone-input.component.html',
  styleUrls: ['./phone-input.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'matx-phone-input',
  },
  providers: [{ provide: MatFormFieldControl, useExisting: PhoneInputComponent }]
})
export class PhoneInputComponent implements OnInit, DoCheck, OnChanges, OnDestroy, ControlValueAccessor, Validator, CanUpdateErrorState, MatFormFieldControl<string> {

  /** Flag render. */
  @ContentChild(PhoneInputFlagDirective) _flatRenderer!: PhoneInputFlagDirective;

  /** Phone number matInput directive */
  @ViewChild('phoneNumberInput') _phoneNumberInput!: MatInput;

  /** Country search matInput directive */
  @ViewChild('countrySearchInput') _countrySearchInput!: MatInput;

  /**
   * Stream that emits whenever the state of the control changes such that the parent `MatFormField`
   * needs to run change detection.
   */
  readonly stateChanges = new Subject<void>();

  /**
   * An optional name for the control type that can be used to distinguish `mat-form-field` elements
   * based on their control type. The form field will add a class,
   * `mat-form-field-type-{{controlType}}` to its root element.
   */
  readonly controlType: string = 'matx-phone-input';

  /** Object used to control when error messages are shown. */
  @Input() errorStateMatcher!: ErrorStateMatcher;

  /**
   * Value of `aria-describedby` that should be merged with the described-by ids
   * which are set by the form-field.
   */
  @Input('aria-describedby') userAriaDescribedBy!: string;

  /** Classes to be passed to the select panel. Supports the same syntax as `ngClass`. */
  // @Input() panelClass!: string | string[] | Set<string> | {[key: string]: any};

  /** Placeholder for country search input */
  @Input() countrySearchPlaceholder!: string;

  /** Whether the control is in an error state. */
  errorState = false;

  /** Whether the control is focused. */
  focused = false;

  /** Filtered countries. */
  _filteredCountries: Country[] = [];

  /** Form control for country search. */
  _countrySearchControl = new FormControl('');

  /** Whether or not the country search is shown. */
  _countrySearch = false;

  /** Default country */
  _defaultCountry!: Country | null;

  /** Selected country */
  _selectedCountry!: Country;

  /** Form control for phone input. */
  _phoneControl = new FormControl('');

  /**
   * Whether the input is currently in an autofilled state. If property is not present on the
   * control it is assumed to be false.
   */
  // readonly autofilled?: boolean;

  private _countriesFilterSubscription = Subscription.EMPTY;

  /** Last country search digits input */
  private _lastCountrySearchDigits!: string | null;

  /** Unique id for this input. */
  private _uid = `matx-phone-input-${nextUniqueId++}`;

  /** `View -> model callback called when value changes` */
  private _onChange: (value: any) => void = () => {};

  /** `View -> model callback called when select has been touched` */
  private _onTouched = () => {};

  /** Selectable country. */
  @Input()
  get selectableCountry() {
    return this._selectableCountry;
  }
  set selectableCountry(value: BooleanInput) {
    this._selectableCountry = coerceBooleanProperty(value);
  }
  private _selectableCountry!: boolean;

  /** Default country code. */
  @Input()
  get defaultCountryCode(): string {
    return this._defaultCountryCode;
  }
  set defaultCountryCode(value: string) {
    this._defaultCountryCode = value;
    this._defaultCountry = this._findCountryByCode(value);
    console.log(this._defaultCountry)
  }
  private _defaultCountryCode!: string;

  /** Show country flag. */
  @Input()
  get showCountryFlag() {
    return this._showCountryFlag;
  }
  set showCountryFlag(value: BooleanInput) {
    this._showCountryFlag = coerceBooleanProperty(value);
  }
  private _showCountryFlag!: boolean;

  /** The value of the control. */
  @Input()
  get value() {
    return this._value;
  }
  set value(newValue: string | null) {
    this._value = newValue;

    this._onChange(newValue);
  }
  private _value!: string | null;

  /** The element ID for this control. */
  @Input()
  get id(): string {
    return this._id;
  }
  set id(value: string) {
    this._id = value || this._uid!;
    this.stateChanges.next();
  }
  private _id!: string;

  /** The placeholder for this control. */
  @Input()
  get placeholder(): string {
    return this._placeholder;
  }
  set placeholder(value: string) {
    this._placeholder = value;
    this.stateChanges.next();
  }
  private _placeholder!: string;

  /** Whether the control is empty. */
  get empty() {
    return (
      true
      /* !this._isNeverEmpty() &&
      !this._elementRef.nativeElement.value &&
      !this._isBadInput() &&
      !this.autofilled */
    );
  }

  /** Whether the `MatFormField` label should try to float. */
  get shouldLabelFloat() {
    return this.focused || !this.empty;
  }

    /** Whether the control is required. */
  @Input()
  get required(): boolean {
    return this._required ?? this.ngControl?.control?.hasValidator(Validators.required) ?? false;
  }
  set required(value: BooleanInput) {
    this._required = coerceBooleanProperty(value);
    this.stateChanges.next();
  }
  private _required!: boolean;

    /** Whether the control is disabled. */
  @Input()
  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(value: BooleanInput) {
    this._disabled = coerceBooleanProperty(value);
    // this._disabled ? this.parts.disable() : this.parts.enable();
    this.stateChanges.next();
  }
  private _disabled = false;

  constructor(
    private _ngZone: NgZone,
    private _changeDetectorRef: ChangeDetectorRef,
    private _elementRef: ElementRef<HTMLElement>,
    @Optional() private _parentForm: NgForm,
    @Optional() private _parentFormGroup: FormGroupDirective,
    @Optional() @Inject(MAT_FORM_FIELD) private _parentFormField: MatFormField,
    @Self() @Optional() public ngControl: NgControl,
    private _defaultErrorStateMatcher: ErrorStateMatcher
  ) {
    if (this.ngControl) {
      // Note: we provide the value accessor through here, instead of
      // the `providers` to avoid running into a circular import.
      this.ngControl.valueAccessor = this;
    }

    // Force setter to be called in case id was not specified.
    this.id = this.id;

    // Filter countries by typing
    this._countriesFilterSubscription = this._countrySearchControl.valueChanges
      .pipe(
        // On selection autocomplete set value to form control
        debounceTime(1),
        filter(() => this._countrySearch),
        startWith(''),
        map(input => `${input || ''}`.trim()),
        distinctUntilChanged(),
        map(input => {
          if (!input) {
            return COUNTRIES;
          }

          const digits = input.match(/^(?:\+|0{1,2})?(\d*)$/);
          if (digits && !digits[1]) {
            return COUNTRIES;
          }

          this._lastCountrySearchDigits = digits ? digits[1] : null;

          const internationalPrefix = this._lastCountrySearchDigits ? this._lastCountrySearchDigits.slice(0, 3) : null;
          const isAlpha2 = input.length <= 2;
          const isAlpha3 = input.length <= 3;
          const upperCaseInput = input.toUpperCase();
          const localLowerCaseInput = input.toLocaleLowerCase();

          return COUNTRIES.filter(country => {
            if (internationalPrefix) {
              return country.callingCode.startsWith(internationalPrefix);
            }

            return (
              (isAlpha2 && country.alpha2.startsWith(upperCaseInput)) ||
              (isAlpha3 && country.alpha3.startsWith(upperCaseInput)) ||
              country.name.toLowerCase().includes(localLowerCaseInput) ||
              (country.localName && country.localName.toLocaleLowerCase().includes(localLowerCaseInput))
            );
          });
        })
      )
      .subscribe(countries => {
        this._filteredCountries = countries;
        this._changeDetectorRef.markForCheck();
      });
  }

  ngOnInit() {
    // Show country select when no default country was specified
    if (!this._defaultCountry) {
      this._countrySearch = true;
      this._changeDetectorRef.markForCheck();
    }
  }

  ngDoCheck() {
    if (this.ngControl) {
      // We need to re-evaluate this on every change detection cycle, because there are some
      // error triggers that we can't subscribe to (e.g. parent form submissions). This means
      // that whatever logic is in here has to be super lean or we risk destroying the performance.
      this.updateErrorState();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    // Updating the disabled state is handled by `mixinDisabled`, but we need to additionally let
    // the parent form field know to run change detection when the disabled state changes.
    if (changes['disabled'] || changes['userAriaDescribedBy']) {
      this.stateChanges.next();
    }
  }

  ngOnDestroy() {
    this._countriesFilterSubscription.unsubscribe();
    this.stateChanges.complete();
  }

  /**
   * Sets the select's value. Part of the ControlValueAccessor interface
   * required to integrate with Angular's core forms API.
   *
   * @param value New value to be written to the model.
   */
  writeValue(value: string | null) {
    console.log(this._defaultCountry)
    this._value = value;
  }

  /**
   * Saves a callback function to be invoked when the select's value
   * changes from user input. Part of the ControlValueAccessor interface
   * required to integrate with Angular's core forms API.
   *
   * @param fn Callback to be triggered when the value changes.
   */
  registerOnChange(fn: (value: string | null) => void) {
    this._onChange = fn;
  }

  /**
   * Saves a callback function to be invoked when the select is blurred
   * by the user. Part of the ControlValueAccessor interface required
   * to integrate with Angular's core forms API.
   *
   * @param fn Callback to be triggered when the component has been touched.
   */
  registerOnTouched(fn: () => {}) {
    this._onTouched = fn;
  }

  /**
   * Disables the select. Part of the ControlValueAccessor interface required
   * to integrate with Angular's core forms API.
   *
   * @param isDisabled Sets whether the component is disabled.
   */
  setDisabledState(isDisabled: boolean) {
    this.disabled = isDisabled;
    this._changeDetectorRef.markForCheck();
    this.stateChanges.next();
  }

  validate(control: AbstractControl) {
    return null;
  }

  registerOnValidatorChange(fn: () => void) {

  }

  /** Updates the error state based on the provided error state matcher. */
  updateErrorState() {
    const oldState = this.errorState;
    const parent = this._parentFormGroup || this._parentForm;
    const matcher = this.errorStateMatcher || this._defaultErrorStateMatcher;
    const control = this.ngControl ? (this.ngControl.control as UntypedFormControl) : null;
    const newState = matcher.isErrorState(control, parent);

    if (newState !== oldState) {
      this.errorState = newState;
      this.stateChanges.next();
    }
  }

  /** Sets the list of element IDs that currently describe this control. */
  setDescribedByIds(ids: string[]) {
    if (ids.length) {
      this._elementRef.nativeElement.setAttribute('aria-describedby', ids.join(' '));
    } else {
      this._elementRef.nativeElement.removeAttribute('aria-describedby');
    }
  }

  /** Handles a click on the control's container. */
  onContainerClick(event: MouseEvent) {
    if (this._countrySearch) {
      // Do not re-focus the input element if the element is already focused. Otherwise it can happen
      // that someone clicks on a time input and the cursor resets to the "hours" field while the
      // "minutes" field was actually clicked. See: https://github.com/angular/components/issues/12849
      if (!this._countrySearchInput.focused) {
        this._countrySearchInput.focus();
      }
    } else {
      const targetElement = event.target as HTMLElement;
      if (this.selectableCountry && targetElement.closest('.matx-phone-input-country')) {
        this._switchToCountrySearch();
      } else {
        // Do not re-focus the input element if the element is already focused. Otherwise it can happen
        // that someone clicks on a time input and the cursor resets to the "hours" field while the
        // "minutes" field was actually clicked. See: https://github.com/angular/components/issues/12849
        if (!this._phoneNumberInput.focused) {
          this._phoneNumberInput.focus();
        }
      }
    }
  }

  _trackByCode(_: number, country: Country) {
    return country.alpha2;
  }

  _findCountryByCode(code: string) {
    const country = COUNTRIES.find(country => {
      const upperCaseCode = code.toUpperCase();
      return (
        country.alpha2 === upperCaseCode ||
        country.alpha3 === upperCaseCode ||
        country.callingCode === code
      );
    });
    return country || null;
  }

  _handleCountrySelect(option: MatOption<string>) {
    const country = this._findCountryByCode(option.value)!;

    if (!this._phoneControl.value && this._lastCountrySearchDigits) {
      const phone = this._lastCountrySearchDigits.slice(country.callingCode.length);
      this._phoneControl.setValue(phone);
    }

    this._selectedCountry = country;
    this._switchToInput();
  }

  _switchToCountrySearch() {
    this._countrySearch = true;
    this._ngZone.onStable.pipe(take(1)).subscribe(() => this._countrySearchInput.focus());
    this._changeDetectorRef.markForCheck();
  }

  _switchToInput() {
    if (!this._filteredCountries.length) {
      // This means country search did not find anything.
      // As a workaround stop propagation,
      // because Material is emitting close event.
      return;
    }

    this._countrySearch = false;
    this._ngZone.onStable.pipe(take(1)).subscribe(() => this._phoneNumberInput.focus());
    this._changeDetectorRef.markForCheck();
  }
}
