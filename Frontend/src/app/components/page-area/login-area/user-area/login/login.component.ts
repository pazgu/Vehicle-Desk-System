import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../../../services/auth.service';
 
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterModule, ReactiveFormsModule, CommonModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
  
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  errorMessage: string | null = null;

  constructor(
  private fb: FormBuilder,
  private http: HttpClient,
  private router: Router,
  private authService: AuthService // <-- Add this line
) {}


  ngOnInit(): void {
    this.loginForm = this.fb.group({
      username: [
        '',
        [
          Validators.required,
          Validators.pattern(/^[A-Za-z֐-׿]+$/), // Hebrew + English letters
          Validators.minLength(3),
          Validators.maxLength(20)
        ]
      ],
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(6)
        ]
      ]
    });
  }

  get f() {
    return this.loginForm.controls;
  }
  
  onLogin(): void {
  this.errorMessage = null;

  if (this.loginForm.invalid) {
    this.loginForm.markAllAsTouched();
    this.errorMessage = 'יש למלא את כל השדות כנדרש';
    return;
  }

  const loginData = this.loginForm.value;
  
  this.http.post<any>('http://localhost:8000/api/login', loginData).subscribe({
    next: (response) => {
      const token = response.access_token; 
      localStorage.setItem('access_token', token);  // Save token in localStorage
      localStorage.setItem('username', response.username);
      localStorage.setItem('first_name', response.first_name);
      localStorage.setItem('last_name', response.last_name);
      localStorage.setItem('role', response.role);

      // Call the setFullName method from AuthService to update the full name
      this.authService.setFullName(response.first_name, response.last_name);
      this.authService.setLoginState(true);


      this.router.navigate(['/home']);  // Change route as needed
    },
    error: (err) => {
      this.errorMessage = err.error?.detail || 'ההתחברות נכשלה';
    }
  });
}

  
}

