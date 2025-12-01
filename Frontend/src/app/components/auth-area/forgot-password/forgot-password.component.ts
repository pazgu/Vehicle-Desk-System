// import { Component, OnDestroy } from '@angular/core';
// import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
// import { CommonModule } from '@angular/common';
// import { Router } from '@angular/router';

// import { AuthService } from '../../../services/auth.service';
// import { EmailHandlerService } from '../../../services/email-handler.service';
// import { EmailRetryComponent } from '../../shared/email-retry/email-retry.component'; // 👈 import the popup

// @Component({
//   selector: 'app-forgot-password',
//   standalone: true,
//   templateUrl: './forgot-password.component.html',
//   styleUrls: ['./forgot-password.component.css'],
//   imports: [CommonModule, ReactiveFormsModule, EmailRetryComponent] // 👈 include the popup here
// })
// export class ForgotPasswordComponent implements OnDestroy {
//   forgotForm: FormGroup;
//   submitted = false;
//   floatingChars: any[] = [];

//   constructor(
//     private fb: FormBuilder,
//     private authService: AuthService,
//     private router: Router,
//     private emailHandlerService: EmailHandlerService
//   ) {
//     this.forgotForm = this.fb.group({
//       email: ['', [Validators.required, Validators.email]]
//     });
//     this.initializeFloatingChars();
//   }

//   get f() { return this.forgotForm.controls; }

//   onSubmit() {
//   this.submitted = true;
//   if (this.forgotForm.invalid) return;

//   const email = this.forgotForm.value.email as string;

//   this.emailHandlerService.handleEmailOperation(
//     this.authService.requestPasswordReset(email),
//     undefined,                                  // no retryCallback (we'll use the endpoint)
//     null,                                       // DO NOT pass identifier; use the server's one
//     (id: string) => this.authService.retryEmail(id, 'forgot_password'),
//     'forgot_password'
//   ).subscribe({
//     next: () => { this.forgotForm.reset(); this.submitted = false; },
//     error: () => {} // non-422 errors will be toasted by AuthInterceptor
//   });
// }

//   navigateBack() {
//     this.emailHandlerService.reset();
//     this.router.navigate(['/login']);
//   }

//   ngOnDestroy() {
//     this.emailHandlerService.reset();
//   }

//   private initializeFloatingChars(): void {
//     const symbols = ['*', '#', '•', '@', '$', '%', '&'];
//     for (let i = 0; i < 50; i++) {
//       this.floatingChars.push({
//         char: symbols[Math.floor(Math.random() * symbols.length)],
//         left: Math.random() * 100,
//         delay: Math.random() * 5,
//         duration: 5 + Math.random() * 5
//       });
//     }
//   }
// }

import { Component, OnDestroy, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { AuthService } from '../../../services/auth.service';
import { EmailHandlerService } from '../../../services/email-handler.service';
import { ToastService } from '../../../services/toast.service';
import { EmailRetryComponent } from '../../shared/email-retry/email-retry.component';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.css'],
  imports: [CommonModule, ReactiveFormsModule, EmailRetryComponent],
})
export class ForgotPasswordComponent implements OnInit, OnDestroy {
  forgotForm: FormGroup;
  submitted = false;
  floatingChars: any[] = [];

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private emailHandlerService: EmailHandlerService,
    private toastService: ToastService
  ) {
    this.forgotForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
    this.initializeFloatingChars();
  }

  ngOnInit() {
    // Inject ToastService into EmailHandlerService for success messages
    this.emailHandlerService.setToastService(this.toastService);
  }

  get f() {
    return this.forgotForm.controls;
  }

  onSubmit() {
    this.submitted = true;
    if (this.forgotForm.invalid) return;

    const email = this.forgotForm.value.email as string;

    // Create a success callback that clears the form
    const successCallback = () => {
      this.forgotForm.reset();
      this.submitted = false;
    };

    this.emailHandlerService
      .handleEmailOperation(
        this.authService.requestPasswordReset(email),
        undefined, // no retryCallback (we'll use the endpoint)
        null, // DO NOT pass identifier; use the server's one
        (id: string) => this.authService.retryEmail(id, 'forgot_password'),
        'forgot_password',
        successCallback // Pass success callback to clear form
      )
      .subscribe({
        next: () => {
          // Success is handled by the service now
        },
        error: () => {}, // non-422 errors will be toasted by AuthInterceptor
      });
  }

  navigateBack() {
    this.emailHandlerService.reset();
    this.router.navigate(['/login']);
  }

  ngOnDestroy() {
    this.emailHandlerService.reset();
  }

  private initializeFloatingChars(): void {
    const symbols = ['*', '#', '•', '@', '$', '%', '&'];
    for (let i = 0; i < 50; i++) {
      this.floatingChars.push({
        char: symbols[Math.floor(Math.random() * symbols.length)],
        left: Math.random() * 100,
        delay: Math.random() * 5,
        duration: 5 + Math.random() * 5,
      });
    }
  }
}
