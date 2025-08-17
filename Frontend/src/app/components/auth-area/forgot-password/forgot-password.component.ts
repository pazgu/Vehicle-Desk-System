// // forgot-password.component.ts
// import { Component } from '@angular/core';
// import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
// import { AuthService } from '../../../services/auth.service';
// import { CommonModule } from '@angular/common';
// import { Router } from '@angular/router';
// import { EmailHandlerService } from '../../../services/email-handler.service';

// @Component({
//   selector: 'app-forgot-password',
//   templateUrl: './forgot-password.component.html',
//   styleUrls: ['./forgot-password.component.css'],
//   imports: [CommonModule, ReactiveFormsModule]
// })
// export class ForgotPasswordComponent {
//   forgotForm: FormGroup;
//   submitted = false;
  
//   floatingChars: { char: string; left: number; delay: number; duration: number }[] = [];
  
//   constructor(
//     private fb: FormBuilder,
//     private authService: AuthService,
//     private router: Router,
//     private emailHandlerService: EmailHandlerService
//   ) {
//     this.forgotForm = this.fb.group({
//       email: ['', [Validators.required, Validators.email]]
//     });
    
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

//   get f() {
//     return this.forgotForm.controls;
//   }

//   onSubmit() {
//     this.submitted = true;

//     if (this.forgotForm.invalid) return;

//     const email = this.forgotForm.value.email;

//     // Create retry callback that calls this method again
//     const retryCallback = () => {
//       this.sendForgotPasswordEmail();
//     };

//     // Use the centralized service to handle the API call and all UI feedback
//     this.emailHandlerService.handleEmailOperation(
//       this.authService.requestPasswordReset(email),
//       retryCallback,
//       email, // This will be used as retry identifier
//       (identifier: string) => this.authService.retryEmail(identifier, 'forgot_password'),
//       'forgot_password' // Specify the email action type
//     ).subscribe();
//   }

//   // Separate method for sending email (used in retry)
//   private sendForgotPasswordEmail() {
//     if (this.forgotForm.invalid) return;

//     const email = this.forgotForm.value.email;
    
//     const retryCallback = () => {
//       this.sendForgotPasswordEmail();
//     };

//     this.emailHandlerService.handleEmailOperation(
//       this.authService.requestPasswordReset(email),
//       retryCallback,
//       email,
//       (identifier: string) => this.authService.retryEmail(identifier, 'forgot_password'),
//       'forgot_password'
//     ).subscribe();
//   }

//   navigateBack() {
//     // Clean up the email handler state when navigating away
//     this.emailHandlerService.reset();
//     this.router.navigate(['/login']);
//   }
// }










// // forgot-password.component.ts
// import { Component } from '@angular/core';
// import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
// import { AuthService } from '../../../services/auth.service';
// import { CommonModule } from '@angular/common';
// import { Router } from '@angular/router';
// import { EmailHandlerService } from '../../../services/email-handler.service';

// @Component({
//   selector: 'app-forgot-password',
//   templateUrl: './forgot-password.component.html',
//   styleUrls: ['./forgot-password.component.css'],
//   imports: [CommonModule, ReactiveFormsModule]
// })
// export class ForgotPasswordComponent {
//   forgotForm: FormGroup;
//   submitted = false;

//   floatingChars: { char: string; left: number; delay: number; duration: number }[] = [];

//   constructor(
//     private fb: FormBuilder,
//     private authService: AuthService,
//     private router: Router,
//     private emailHandlerService: EmailHandlerService
//   ) {
//     this.forgotForm = this.fb.group({
//       email: ['', [Validators.required, Validators.email]]
//     });

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

//   get f() {
//     return this.forgotForm.controls;
//   }

//   onSubmit() {
//     console.log('🚀 Form submitted, valid:', this.forgotForm.valid);
//     this.submitted = true;

//     if (this.forgotForm.invalid) {
//       console.log('❌ Form invalid, stopping');
//       return;
//     }

//     const email = this.forgotForm.value.email;
//     console.log('📧 Sending email to:', email);

//     // Create retry callback that calls this method again
//     const retryCallback = () => {
//       console.log('🔄 Retry callback executed');
//       this.sendForgotPasswordEmail();
//     };

//     // Use the centralized service to handle the API call and all UI feedback
//     this.emailHandlerService.handleEmailOperation(
//       this.authService.requestPasswordReset(email),
//       retryCallback,
//       email, // This will be used as retry identifier
//       (identifier: string) => this.authService.retryEmail(identifier, 'forgot_password'),
//       'forgot_password' // Specify the email action type
//     ).subscribe({
//       next: (result) => {
//         console.log('📧 Email operation completed:', result);
//         // Clear the form on success (result will be the API response on success, null on error)
//         if (result !== null) {
//           console.log('✅ Success - clearing form');
//           this.forgotForm.reset();
//           this.submitted = false;
//         }
//       },
//       error: (error) => {
//         console.error('📧 Email operation error:', error);
//       }
//     });
//   }

//   // Separate method for sending email (used in retry)
//   private sendForgotPasswordEmail() {
//     console.log('🔄 Sending forgot password email (retry)');
    
//     if (this.forgotForm.invalid) {
//       console.log('❌ Form invalid in retry, stopping');
//       return;
//     }

//     const email = this.forgotForm.value.email;

//     const retryCallback = () => {
//       console.log('🔄 Nested retry callback executed');
//       this.sendForgotPasswordEmail();
//     };

//     this.emailHandlerService.handleEmailOperation(
//       this.authService.requestPasswordReset(email),
//       retryCallback,
//       email,
//       (identifier: string) => this.authService.retryEmail(identifier, 'forgot_password'),
//       'forgot_password'
//     ).subscribe({
//       next: (result) => {
//         console.log('📧 Retry email operation completed:', result);
//         // Clear the form on success
//         if (result !== null) {
//           console.log('✅ Retry success - clearing form');
//           this.forgotForm.reset();
//           this.submitted = false;
//         }
//       },
//       error: (error) => {
//         console.error('📧 Retry email operation error:', error);
//       }
//     });
//   }

//   navigateBack() {
//     console.log('🔙 Navigating back');
//     // Clean up the email handler state when navigating away
//     this.emailHandlerService.reset();
//     this.router.navigate(['/login']);
//   }
// }


import { Component, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { AuthService } from '../../../services/auth.service';
import { EmailHandlerService } from '../../../services/email-handler.service';
import { EmailRetryComponent } from '../../shared/email-retry/email-retry.component'; // 👈 import the popup

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.css'],
  imports: [CommonModule, ReactiveFormsModule, EmailRetryComponent] // 👈 include the popup here
})
export class ForgotPasswordComponent implements OnDestroy {
  forgotForm: FormGroup;
  submitted = false;
  floatingChars: any[] = [];

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private emailHandlerService: EmailHandlerService
  ) {
    this.forgotForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
    this.initializeFloatingChars();
  }

  get f() { return this.forgotForm.controls; }

  onSubmit() {
  this.submitted = true;
  if (this.forgotForm.invalid) return;

  const email = this.forgotForm.value.email as string;

  this.emailHandlerService.handleEmailOperation(
    this.authService.requestPasswordReset(email),
    undefined,                                  // no retryCallback (we'll use the endpoint)
    null,                                       // DO NOT pass identifier; use the server's one
    (id: string) => this.authService.retryEmail(id, 'forgot_password'),
    'forgot_password'
  ).subscribe({
    next: () => { this.forgotForm.reset(); this.submitted = false; },
    error: () => {} // non-422 errors will be toasted by AuthInterceptor
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
        duration: 5 + Math.random() * 5
      });
    }
  }
}
