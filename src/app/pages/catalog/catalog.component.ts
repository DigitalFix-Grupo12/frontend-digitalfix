import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ApiService, CatalogItem } from '../../core/services/api.service';
import { IconComponent } from '../../core/ui/icon.component';
import { clp, httpErrorMessage } from '../../core/ui/format';

type Tab = 'ALL' | 'SERVICIO' | 'REPUESTO';
type Sort = 'nombre' | 'tarifa-asc' | 'tarifa-desc' | 'stock';

const LOW_STOCK = 10;

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './catalog.component.html',
})
export class CatalogComponent implements OnInit {
  private api = inject(ApiService);
  readonly clp = clp;
  readonly lowStock = LOW_STOCK;

  items = signal<CatalogItem[] | null>(null);
  error = signal<string | null>(null);
  tab = signal<Tab>('ALL');
  search = signal('');
  sort = signal<Sort>('nombre');

  maxStock = computed(() => Math.max(1, ...(this.items() ?? []).map((i) => i.stock)));
  services = computed(() => (this.items() ?? []).filter((i) => i.tipo === 'SERVICIO').length);
  parts = computed(() => (this.items() ?? []).filter((i) => i.tipo === 'REPUESTO').length);
  lowCount = computed(() => (this.items() ?? []).filter((i) => i.stock < LOW_STOCK).length);
  inventoryValue = computed(() =>
    (this.items() ?? []).filter((i) => i.tipo === 'REPUESTO').reduce((acc, i) => acc + i.stock * i.tarifa, 0)
  );

  visible = computed(() => {
    const t = this.tab();
    const q = this.search().trim().toLowerCase();
    let list = this.items() ?? [];
    if (t !== 'ALL') list = list.filter((i) => i.tipo === t);
    if (q) list = list.filter((i) => i.nombre.toLowerCase().includes(q));
    const s = this.sort();
    return [...list].sort((a, b) =>
      s === 'tarifa-asc' ? a.tarifa - b.tarifa
        : s === 'tarifa-desc' ? b.tarifa - a.tarifa
        : s === 'stock' ? a.stock - b.stock
        : a.nombre.localeCompare(b.nombre, 'es')
    );
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.items.set(null);
    this.error.set(null);
    this.api.catalog().subscribe({
      next: (d) => this.items.set(d),
      error: (err) => {
        this.error.set(httpErrorMessage(err));
        this.items.set([]);
      },
    });
  }

  stockPct(i: CatalogItem): number {
    return Math.max(4, (i.stock / this.maxStock()) * 100);
  }
}
