import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
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
  originalValue: any = null;

  constructor(
    private fb: FormBuilder,
    private guidelinesService: GuidelinesServiceAdmin,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      items: this.fb.array([]),
    });

    this.guidelinesService.getLatest().subscribe({
      next: (doc) => {
        if (!doc) return;
        this.items.clear();

        doc.items.forEach((text: string) => this.addItem(text));

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
    return (
      JSON.stringify(this.form.getRawValue()) !==
      JSON.stringify(this.originalValue)
    );
  }

  canSave(): { valid: boolean; message: string } {
    const itemsArray = this.items.value;


    if (itemsArray.length === 0) {
      return { valid: false, message: 'יש להוסיף לפחות הנחיה אחת לפני השמירה' };
    }

    const hasEmptyItems = itemsArray.some((item: string) => !item?.trim());
    if (hasEmptyItems) {
      return {
        valid: false,
        message: 'אי אפשר לשמור עם הנחיות ריקות. מלא את כל ההנחיות או מחק אותן',
      };
    }

    return { valid: true, message: '' };
  }

  save() {
    const validation = this.canSave();

    if (!validation.valid) {
      this.toastService.show(validation.message, 'info');
      this.form.markAllAsTouched();
      return;
    }

    if (!this.hasChanges()) {
      this.toastService.show('לא בוצעו שינויים לשמירה', 'info');
      return;
    }

    const payload = {
      items: this.items.value.map((item: string) => item.trim()),
    };

    this.guidelinesService.update(payload).subscribe({
      next: () => {
        this.toastService.show('הנתונים נשמרו בהצלחה!', 'success');
        this.originalValue = this.form.getRawValue();
      },
      error: (e) => {
        console.error('Error updating guidelines:', e);
        this.toastService.show('שגיאה בשמירת נתונים', 'error');
      },
    });
  }
  hasEmptyItem(): boolean {
  return this.items.controls.some(ctrl => !ctrl.value?.trim());
}
}
