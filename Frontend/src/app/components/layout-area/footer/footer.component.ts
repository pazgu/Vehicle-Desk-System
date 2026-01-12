import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.css']
})
export class FooterComponent {
  currentYear = new Date().getFullYear();
  
  onImageError(event: any) {
    console.error('Failed to load image from:', event.target.src);
  }
  
  onImageLoad(event: any) {
    console.log('Image loaded successfully:', event.target.src);
    console.log('Image dimensions:', event.target.width, 'x', event.target.height);
  }
}