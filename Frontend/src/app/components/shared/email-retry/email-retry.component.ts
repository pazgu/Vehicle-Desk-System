// import { Component, HostListener } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { EmailHandlerService } from '../../../services/email-handler.service';

// @Component({
//   selector: 'app-email-retry',
//   standalone: true,
//   imports: [CommonModule],
//   templateUrl: './email-retry.component.html',
//   styleUrls: ['./email-retry.component.css']
// })
// export class EmailRetryComponent {
//   constructor(private emailHandlerService: EmailHandlerService) {}
//   get state$() { return this.emailHandlerService.state$; }
//   onRetry() { this.emailHandlerService.retry(); }
//   onClose() { this.emailHandlerService.reset(); }

//   @HostListener('document:keydown', ['$event'])
//   onKeydown(e: KeyboardEvent) {
//     if (e.key === 'Escape') this.onClose();
//     if (e.key === 'Enter') this.onRetry();
//   }
// }

import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmailHandlerService } from '../../../services/email-handler.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-email-retry',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './email-retry.component.html',
  styleUrls: ['./email-retry.component.css']
})
export class EmailRetryComponent {
  constructor(
    private emailHandlerService: EmailHandlerService,
    private toastService: ToastService
  ) {}

  get state$() { 
    return this.emailHandlerService.state$; 
  }

  onRetry() { 
    this.emailHandlerService.retry(); 
  }

  onClose() { 
    this.emailHandlerService.reset(); 
  }

  // Map error messages to more specific Hebrew messages
  getErrorMessage(message: string | null | undefined): string {
    if (!message) {
      return 'אירעה תקלה זמנית. תרצה לנסות שוב?';
    }

    const lowerMessage = message.toLowerCase();
    
    // Check for specific error patterns in English
    if (lowerMessage.includes('could not send the password reset email') ||
        lowerMessage.includes('password reset email')) {
      return 'לא ניתן לשלוח מייל איפוס סיסמה, נסה שנית מאוחר יותר';
    }
    
    if (lowerMessage.includes('user not found') || 
        lowerMessage.includes('email not found') || 
        lowerMessage.includes('not exist') ||
        lowerMessage.includes('לא נמצא')) {
      return 'כתובת האימייל לא קיימת במערכת. אנא בדוק את הכתובת ונסה שוב.';
    }
    
    if (lowerMessage.includes('invalid email') || 
        lowerMessage.includes('email format') ||
        lowerMessage.includes('לא תקין')) {
      return 'כתובת האימייל לא תקינה. אנא בדוק את הכתובת ונסה שוב.';
    }
    
    if (lowerMessage.includes('rate limit') || 
        lowerMessage.includes('too many') ||
        lowerMessage.includes('יותר מדי')) {
      return 'נשלחו יותר מדי בקשות. אנא המתן מספר דקות ונסה שוב.';
    }
    
    if (lowerMessage.includes('server error') || 
        lowerMessage.includes('internal error') ||
        lowerMessage.includes('שרת')) {
      return 'אירעה שגיאת שרת זמנית. אנא נסה שוב בעוד מספר דקות.';
    }
    
    if (lowerMessage.includes('network') || 
        lowerMessage.includes('connection') ||
        lowerMessage.includes('רשת')) {
      return 'בעיית חיבור לאינטרנט. אנא בדוק את החיבור ונסה שוב.';
    }

    // If no specific pattern matches, return the original message or a default
    return message || 'אירעה תקלה זמנית. תרצה לנסות שוב?';
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent) {
    const state = this.emailHandlerService.getCurrentState();
    if (state.visible || state.showRetry) {
      if (e.key === 'Escape') {
        this.onClose();
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        this.onRetry();
      }
    }
  }
}