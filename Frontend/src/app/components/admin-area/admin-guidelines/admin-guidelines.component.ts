import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { GuidelinesServiceAdmin } from '../../../services/guildeline-admin.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-admin-guidelines',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-guidelines.component.html',
  styleUrls: ['./admin-guidelines.component.css'],
})
export class AdminGuidelinesComponent implements OnInit {
  form!: FormGroup;
  originalValue: any = null; // to track original data

  constructor(
    private fb: FormBuilder,
    private guidelinesService: GuidelinesServiceAdmin,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      title: ['', Validators.required],
      items: this.fb.array([]),
    });

    this.guidelinesService.getLatest().subscribe({
      next: (doc) => {
        if (!doc) return;
        this.form.patchValue({ title: doc.title });
        this.items.clear();

        doc.items.forEach((text: string) => this.addItem(text));

        // Store the initial form state
        this.originalValue = this.form.getRawValue();
      },
      error: () => this.toastService.show('שגיאה בטעינת נתונים', 'error'),
    });
  }

  get items(): FormArray<FormControl<string>> {
    return this.form.get('items') as FormArray<FormControl<string>>;
  }

  addItem(text = '') {
    this.items.push(
      new FormControl<string>(text, {
        nonNullable: true,
        validators: [Validators.required],
      })
    );
  }

  removeItem(index: number) {
  if (index < 0 || index >= this.items.length) return;
  this.items.removeAt(index);
}


  trackByControl = (_: number, ctrl: FormControl<string>) => ctrl;

  


  hasChanges(): boolean {
    return JSON.stringify(this.form.getRawValue()) !== JSON.stringify(this.originalValue);
  }

  save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (!this.hasChanges()) {
      this.toastService.show('לא בוצעו שינויים לשמירה', 'info');
      return;
    }

    const payload = {
      title: this.form.value.title as string,
      items: this.items.value as string[],
    };

    this.guidelinesService.update(payload).subscribe({
      next: () => {
        this.toastService.show('הנתונים נשמרו בהצלחה!', 'success');
        this.originalValue = this.form.getRawValue(); // reset baseline
      },
      error: () => {
        this.toastService.show('שגיאה בשמירת נתונים', 'error');
      },
    });
  }
}
