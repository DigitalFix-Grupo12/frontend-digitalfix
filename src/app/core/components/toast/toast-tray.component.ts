import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-toast-tray',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast-tray.component.html',
  styleUrl: './toast-tray.component.css',
})
export class ToastTrayComponent {
  toastService = inject(ToastService);
}
