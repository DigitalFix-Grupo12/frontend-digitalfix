import { Component, ElementRef, effect, inject, viewChild } from '@angular/core';
import { ConfirmService } from '../../services/confirm.service';
import { IconComponent } from '../../ui/icon.component';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [IconComponent],
  host: { '(document:keydown.escape)': 'confirm.answer(false)' },
  template: `
    @if (confirm.current(); as c) {
      <div class="modal-wrap">
        <div class="backdrop" (click)="confirm.answer(false)"></div>
        <div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-msg">
          <div class="modal-icon" [class.modal-icon--info]="c.tone === 'info'">
            <app-icon [name]="c.tone === 'info' ? 'info' : 'alert'" [size]="20" />
          </div>
          <h3 id="confirm-title">{{ c.title }}</h3>
          <p id="confirm-msg">{{ c.message }}</p>
          <div class="modal-actions">
            <button class="btn btn--ghost" (click)="confirm.answer(false)">{{ c.cancelLabel }}</button>
            <button #ok class="btn" [class.btn--danger-solid]="c.tone === 'danger'" [class.btn--primary]="c.tone === 'info'"
                    (click)="confirm.answer(true)">{{ c.confirmLabel }}</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmDialogComponent {
  confirm = inject(ConfirmService);
  private ok = viewChild<ElementRef<HTMLButtonElement>>('ok');

  constructor() {
    // Foco en la accion principal al abrir (teclado: Enter confirma, Esc cancela).
    effect(() => {
      if (this.confirm.current()) queueMicrotask(() => this.ok()?.nativeElement.focus());
    });
  }
}
