// // src/app/components/email-retry/email-retry.component.ts
// import { Component } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { Observable } from 'rxjs';
// import { EmailHandlerService, EmailHandlerState } from '../../../services/email-handler.service';

// @Component({
//   selector: 'app-email-retry',
//   standalone: true,
//   imports: [CommonModule],
//   templateUrl: './email-retry.component.html',
//   styleUrls: ['./email-retry.component.css']
// })
// export class EmailRetryComponent {
//   public state$: Observable<EmailHandlerState>;
//   public retryCooldown$: Observable<number>;

//   constructor(private emailHandlerService: EmailHandlerService) {
//     this.state$ = this.emailHandlerService.state$;
//     this.retryCooldown$ = this.emailHandlerService.retryCooldown$;
//   }

//   onRetry(): void {
//     this.emailHandlerService.retry();
//   }

//   onClose(): void {
//     this.emailHandlerService.closeRetryToast();
//   }
// }





// // src/app/components/email-retry/email-retry.component.ts
// import { Component, OnInit, OnDestroy } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { Observable, Subscription } from 'rxjs';
// import { EmailHandlerService, EmailHandlerState } from '../../../services/email-handler.service';

// @Component({
//   selector: 'app-email-retry',
//   standalone: true,
//   imports: [CommonModule],
//   templateUrl: './email-retry.component.html',
//   styleUrls: ['./email-retry.component.css']
// })
// export class EmailRetryComponent implements OnInit, OnDestroy {
//   public state$: Observable<EmailHandlerState>;
//   public retryCooldown$: Observable<number>;
//   private subscription?: Subscription;

//   constructor(private emailHandlerService: EmailHandlerService) {
//     this.state$ = this.emailHandlerService.getState();
//     this.retryCooldown$ = this.emailHandlerService.retryCooldown$;
//   }

//   ngOnInit() {
//     console.log('🔄 Email Retry Component - INITIALIZED');
    
//     // Debug subscription to see state changes
//     this.subscription = this.state$.subscribe(state => {
//       console.log('🔄 Email Retry Component - State changed:', {
//         showRetry: state.showRetry,
//         message: state.message,
//         isLoading: state.isLoading,
//         isCooldownActive: state.isCooldownActive,
//         cooldownSeconds: state.cooldownSeconds
//       });
//     });
//   }

//   ngOnDestroy() {
//     console.log('🔄 Email Retry Component - DESTROYED');
//     this.subscription?.unsubscribe();
//   }

//   onRetry(): void {
//     console.log('🔄 Retry button clicked');
//     this.emailHandlerService.retry();
//   }

//   onClose(): void {
//     console.log('🔄 Close button clicked');
//     this.emailHandlerService.closeRetryToast();
//   }
// }





import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmailHandlerService } from '../../../services/email-handler.service';

@Component({
  selector: 'app-email-retry',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './email-retry.component.html',
  styleUrls: ['./email-retry.component.css']
})
export class EmailRetryComponent {
  constructor(private emailHandlerService: EmailHandlerService) {}
  get state$() { return this.emailHandlerService.state$; }
  onRetry() { this.emailHandlerService.retry(); }
  onClose() { this.emailHandlerService.reset(); }

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') this.onClose();
    if (e.key === 'Enter') this.onRetry();
  }
}
