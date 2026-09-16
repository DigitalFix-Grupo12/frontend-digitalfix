import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { appConfig } from '../../core/config/app-config';

interface AuditEvent { id: number; usuario: string; accion: string; fecha: string; }
type SortKey = 'id' | 'usuario' | 'accion' | 'fecha';

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './audit.component.html',
})
export class AuditComponent implements OnInit {
  private http = inject(HttpClient);
  events = signal<AuditEvent[]>([]);
  error = signal<string | null>(null);
  search = signal('');
  sortKey = signal<SortKey>('fecha');
  sortDir = signal<1 | -1>(-1);

  filteredEvents = computed(() => {
    const term = this.search().trim().toLowerCase();
    const key = this.sortKey();
    const dir = this.sortDir();

    let list = this.events();
    if (term) {
      list = list.filter(
        (e) => e.usuario.toLowerCase().includes(term) || e.accion.toLowerCase().includes(term)
      );
    }

    return [...list].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  });

  ngOnInit(): void {
    this.http.get<AuditEvent[]>(`${appConfig.api.baseUrl}/api/audit`).subscribe({
      next: (data) => this.events.set(data),
      error: (err) => this.error.set(`HTTP ${err.status}`),
    });
  }

  toggleSort(key: SortKey): void {
    if (this.sortKey() === key) {
      this.sortDir.update((d) => (d === 1 ? -1 : 1));
    } else {
      this.sortKey.set(key);
      this.sortDir.set(1);
    }
  }
}
