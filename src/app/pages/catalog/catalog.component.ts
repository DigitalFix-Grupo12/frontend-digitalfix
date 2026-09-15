import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { appConfig } from '../../core/config/app-config';

interface CatalogItem { id: number; nombre: string; stock: number; tarifa: number; }

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './catalog.component.html',
})
export class CatalogComponent implements OnInit {
  private http = inject(HttpClient);
  items: CatalogItem[] = [];
  error: string | null = null;

  ngOnInit(): void {
    this.http.get<CatalogItem[]>(`${appConfig.api.baseUrl}/api/catalog/services`).subscribe({
      next: (data) => (this.items = data),
      error: (err) => (this.error = `HTTP ${err.status}`),
    });
  }
}
