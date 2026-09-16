import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { appConfig } from '../../core/config/app-config';

interface CatalogItem { id: number; nombre: string; stock: number; tarifa: number; }
type SortKey = 'id' | 'nombre' | 'stock' | 'tarifa';

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './catalog.component.html',
})
export class CatalogComponent implements OnInit {
  private http = inject(HttpClient);
  items = signal<CatalogItem[]>([]);
  error = signal<string | null>(null);
  search = signal('');
  sortKey = signal<SortKey>('id');
  sortDir = signal<1 | -1>(1);

  filteredItems = computed(() => {
    const term = this.search().trim().toLowerCase();
    const key = this.sortKey();
    const dir = this.sortDir();

    let list = this.items();
    if (term) list = list.filter((i) => i.nombre.toLowerCase().includes(term));

    return [...list].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  });

  ngOnInit(): void {
    this.http.get<CatalogItem[]>(`${appConfig.api.baseUrl}/api/catalog/services`).subscribe({
      next: (data) => this.items.set(data),
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
