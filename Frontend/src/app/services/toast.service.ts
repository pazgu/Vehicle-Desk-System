import { Injectable } from '@angular/core';

type ToastType = 'success' | 'error' | 'neutral' ;// Add your custom types here

@Injectable({ providedIn: 'root' })
export class ToastService {

  private getContainer(): HTMLElement {
    let container = document.querySelector<HTMLElement>('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  show(message: string, type: ToastType = 'success') {
    const container = this.getContainer();
    const toast = document.createElement('div');
    toast.className = `custom-toast ${type}`;
    toast.innerText = message;
    container.appendChild(toast);

    const sound = new Audio('assets/sounds/notif.mp3');
    sound.play().catch(e => console.warn('Sound play failed:', e));

    setTimeout(() => {
      toast.remove();
    }, 5000);
  }

  showPersistent(message: string, type: ToastType = 'neutral') {
  const container = this.getContainer();

  // ✅ Check if a persistent toast with the same text already exists
  const existing = Array.from(container.querySelectorAll('.toast.persistent'))
    .find(toast => toast.textContent?.replace('OK', '').trim() === message.trim());

  if (existing) {
    console.warn('Duplicate persistent toast blocked:', message);
    return; // Don't create another one
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type} persistent`;
  toast.innerText = message;

  const okButton = document.createElement('button');
  okButton.className = 'toast-ok-btn';
  okButton.innerText = 'OK';
  okButton.onclick = () => toast.remove();
  toast.appendChild(okButton);

  container.appendChild(toast);

  const sound = new Audio('assets/sounds/info.mp3');
  sound.play().catch(e => console.warn('Sound play failed:', e));
}


  clearAll() {
    const container = document.querySelector('.toast-container');
    if (container) container.remove();
  }
}