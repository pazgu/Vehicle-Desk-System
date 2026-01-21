import { Component, Inject, OnInit } from '@angular/core';
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';

export type ConfirmDialogMode = 'confirm' | 'block';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  noRestoreText?: string;
  isDestructive?: boolean;

  mode?: ConfirmDialogMode; 
  initialDuration?: number; 
  initialReason?: string; 
  durationLabel?: string; 
  reasonLabel?: string; 
  reasonPlaceholder?: string; 
}

export type ConfirmDialogResult =
  | false
  | true
  | {
      confirmed: true;
      duration: number;
      reason: string;
    };

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, ReactiveFormsModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrls: ['./confirm-dialog.component.css'],
})
export class ConfirmDialogComponent implements OnInit {
  mode: ConfirmDialogMode = 'confirm';
  blockForm!: FormGroup;

  constructor(
    public dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData,
    private fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this.mode = this.data.mode ?? 'confirm';

    if (this.mode === 'block') {
      this.blockForm = this.fb.group({
        duration: [
          this.data.initialDuration ?? 14,
          [
            Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)
          ],
        ],
        reason: [
          this.data.initialReason ?? '',
          [
            Validators.required,
            Validators.minLength(5),
            this.noWhitespaceValidator,
          ],
        ],
      });
    }
  }

  noWhitespaceValidator(control: AbstractControl): ValidationErrors | null {
    const val = (control.value || '').toString();
    return val.trim().length ? null : { whitespace: true };
  }

  close(): void {
    this.dialogRef.close(false);
  }

  confirm(): void {
    if (this.mode === 'confirm') {
      this.dialogRef.close(true);
      return;
    }

    if (!this.blockForm || this.blockForm.invalid) {
      this.blockForm?.markAllAsTouched();
      return;
    }

    const duration = Number(this.blockForm.get('duration')?.value);
    const reason = (this.blockForm.get('reason')?.value || '').trim();

    const result: ConfirmDialogResult = {
      confirmed: true,
      duration,
      reason,
    };

    this.dialogRef.close(result);
  }

  get durationCtrl() {
    return this.blockForm?.get('duration');
  }

  get reasonCtrl() {
    return this.blockForm?.get('reason');
  }
}
