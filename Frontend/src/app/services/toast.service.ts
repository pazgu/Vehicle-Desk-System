import { Injectable } from '@angular/core';

type ToastType = 'success' | 'error'  ;// Add your custom types here

@Injectable({ providedIn: 'root' })
export class ToastService {
  show(message: string, type: ToastType='success') {
    console.log('Toast shown:', message, type); 
    const toast = document.createElement('div');
    toast.className = `custom-toast ${type}`;
    toast.innerText = message;
    document.body.appendChild(toast);

     // ✅ Play sound when showing toast
    const sound = new Audio('assets/sounds/notif.mp3');
    sound.play().catch(e => console.warn('Sound play failed:', e));

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }
}