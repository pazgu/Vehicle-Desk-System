import { Component } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.css'],
  imports:[CommonModule,ReactiveFormsModule]
})
export class ForgotPasswordComponent {
  forgotForm: FormGroup;
  submitted = false;
  message = '';
  error = '';

  constructor(private fb: FormBuilder, private authService: AuthService) {
    this.forgotForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

get f() {
  return this.forgotForm.controls;
}

  onSubmit() {
    this.submitted = true;
    this.message = '';
    this.error = '';

    if (this.forgotForm.invalid) return;

    const email = this.forgotForm.value.email;
    console.log(email)
    this.authService.requestPasswordReset(email).subscribe({
      next: res => this.message = res.message,
      error: err => this.error = err.error.detail || 'Failed to send reset email'
    });
  }
}
