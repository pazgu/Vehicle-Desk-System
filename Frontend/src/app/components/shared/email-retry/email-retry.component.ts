import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmailRetryService, RetryToast } from '../../../services/email-retry.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-email-retry',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './email-retry.component.html',
  styleUrls: ['./email-retry.component.css']
})
export class EmailRetryComponent {
  isLoading$: Observable<boolean>;
  retryToast$: Observable<RetryToast | null>;

  constructor(private emailRetryService: EmailRetryService) {
    this.isLoading$ = this.emailRetryService.isLoading$;
    this.retryToast$ = this.emailRetryService.retryToast$;
  }

  onRetry(toast: RetryToast): void {
    toast.onRetry();
  }

  onClose(): void {
    this.emailRetryService.hideToast();
  }
}