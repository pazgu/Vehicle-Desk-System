import { Component } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

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
floatingChars: { char: string; left: number; delay: number; duration: number }[] = [];


  constructor(private fb: FormBuilder, private authService: AuthService,  private router: Router) {
    this.forgotForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });

   const symbols = ['*', '#', '•', '@', '$', '%', '&'];
  for (let i = 0; i < 50; i++) {
    this.floatingChars.push({
      char: symbols[Math.floor(Math.random() * symbols.length)],
      left: Math.random() * 100, // 0–100vw
      delay: Math.random() * 5, // seconds
      duration: 5 + Math.random() * 5 // 5–10s
    });
  }
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
    this.authService.requestPasswordReset(email).subscribe({
      next: res => this.message = res.message,
      error: err => this.error = err.error.detail || 'Failed to send reset email'
    });
  }

  navigateBack() {
  this.router.navigate(['/login']); // update this if your login route is different
}
}
