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

@Component({
  selector: 'app-admin-guidelines',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-guidelines.component.html',
  styleUrls: ['./admin-guidelines.component.css'],
})
export class AdminGuidelinesComponent implements OnInit {
  form!: FormGroup;

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    // build the form HERE (not in field initializers)
    this.form = this.fb.group({
      title: new FormControl<string>('הנחיות נסיעה', { nonNullable: true, validators: [Validators.required] }),
      items: this.fb.array([]),
    });

    // (optional) seed with whatever the user modal shows now:
    const seed = [
      'הנסיעה מותרת לשימוש עובד/ת בלבד מעל גיל 18.',
      'יש להחזיר את הרכב בזמן, נקי, ובדלק/טעינה כנדרש.',
      'חל איסור להסיע נוסעים ללא אישור מנהל.',
      'כל עבירת תנועה באחריות הנהג/ת.',
      'במקרה תקלה/תאונה יש לדווח מיד למנהל המערכת.',
    ];
    seed.forEach((t) => this.addItem(t));
  }

  // convenience getter
  get items(): FormArray<FormGroup<{ id: FormControl<string>; text: FormControl<string> }>> {
    return this.form.get('items') as any;
  }

  addItem(text = '') {
    const group = this.fb.group({
      id: new FormControl<string>(crypto.randomUUID(), { nonNullable: true }),
      text: new FormControl<string>(text, { nonNullable: true, validators: [Validators.required] }),
    });
    this.items.push(group);
  }

  removeItem(index: number) {
    this.items.removeAt(index);
  }

  trackById = (_: number, fg: FormGroup) => fg.get('id')?.value;

  // TODO: wire to backend later
  save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const payload = {
      title: this.form.value.title,
      items: this.items.value.map((x) => ({ id: x.id, text: x.text })),
    };
    console.log('SAVE payload:', payload);
    // call your GuidelinesService here when backend is ready
  }
}
