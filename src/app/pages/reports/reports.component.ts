import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { appConfig } from '../../core/config/app-config';

interface SeriePoint { label: string; ordenes: number; }
interface Kpis {
  ordenesPorHora: number;
  tiempoResolucionPromedioMin: number;
  estadosActivos: number;
  serie: SeriePoint[];
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reports.component.html',
})
export class ReportsComponent implements OnInit {
  private http = inject(HttpClient);
  kpis = signal<Kpis | null>(null);
  error = signal<string | null>(null);

  maxSerieValue = computed(() => {
    const serie = this.kpis()?.serie ?? [];
    return Math.max(1, ...serie.map((p) => p.ordenes));
  });

  ngOnInit(): void {
    this.http.get<Kpis>(`${appConfig.api.baseUrl}/api/report/kpis?range=last24h`).subscribe({
      next: (data) => this.kpis.set(data),
      error: (err) => this.error.set(`HTTP ${err.status}`),
    });
  }

  barHeight(value: number): number {
    // Alto en px dentro de una franja de 120px máximo.
    return Math.round((value / this.maxSerieValue()) * 110) + 6;
  }
}
