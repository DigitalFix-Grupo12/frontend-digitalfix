import { Component, inject } from '@angular/core';
import { ToastService } from '../../services/toast.service';
import { IconComponent } from '../../ui/icon.component';

@Component({
  selector: 'app-toast-tray',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="toasts" aria-live="polite">
      @for (t of toastService.toasts(); track t.id) {
        <div class="toast toast--{{ t.kind }}" (click)="toastService.dismiss(t.id)" role="status">
          <app-icon [name]="t.kind === 'success' ? 'check' : t.kind === 'error' ? 'alert' : 'info'" />
          <span>{{ t.message }}</span>
        </div>
      }
    </div>
  `,
})
export class ToastTrayComponent {
  toastService = inject(ToastService);
}
