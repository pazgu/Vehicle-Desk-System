import { Injectable } from '@angular/core';

type ToastType = 'success' | 'error' | 'neutral' ;// Add your custom types here

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
    }, 5000);
  }
  showPersistent(message: string, type: ToastType = 'neutral') {
    const toast = document.createElement('div');
    toast.className = `custom-toast ${type} persistent`;
    toast.innerText = message;

    // ✅ Add close button
    const closeButton = document.createElement('button');
    closeButton.className = 'toast-close-btn';
    closeButton.innerText = '×';
    closeButton.onclick = () => toast.remove();
    toast.appendChild(closeButton);

    document.body.appendChild(toast);

    // ✅ Play sound
    const sound = new Audio('assets/sounds/info.mp3');
    sound.play().catch(e => console.warn('Sound play failed:', e));
  }
  clearAll() {
  const toasts = document.querySelectorAll('.custom-toast');
  toasts.forEach(t => t.remove());
}

}