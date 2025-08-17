import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.css'],

  imports:[CommonModule,ReactiveFormsModule,MatIconModule]
})
export class ResetPasswordComponent implements OnInit {
  resetForm!: FormGroup;
  submitted = false;
  message = '';
  error = '';
  token: string = '';
  showPassword = false;
  showConfirmPassword= false;
  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.token = params['token'];
       });
       
    this.resetForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, { validator: this.passwordsMatch });
  }

  get f() {
    return this.resetForm.controls;
  }
 togglePassword() {
    this.showPassword = !this.showPassword;
  }
   toggleConfirmPassword() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }
  passwordsMatch(form: FormGroup) {
    return form.get('password')?.value === form.get('confirmPassword')?.value
      ? null : { mismatch: true };
  }

  onSubmit() {
    this.submitted = true;
    if (this.resetForm.invalid) return;

    const password = this.resetForm.value.password;

    this.authService.resetPassword(this.token, password).subscribe({
      next: () => {
        this.message = 'Password has been reset successfully';
      },
      error: (err) => {
        this.error = err.error.detail || 'Failed to reset password';
      }
    });
  }
}
