import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { appConfig } from '../../core/config/app-config';

interface Kpis { ordenesPorHora: number; tiempoResolucionPromedioMin: number; estadosActivos: number; }

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reports.component.html',
})
export class ReportsComponent implements OnInit {
  private http = inject(HttpClient);
  kpis: Kpis | null = null;
  error: string | null = null;

  ngOnInit(): void {
    this.http.get<Kpis>(`${appConfig.api.baseUrl}/api/report/kpis?range=last24h`).subscribe({
      next: (data) => (this.kpis = data),
      error: (err) => (this.error = `HTTP ${err.status}`),
    });
  }
}
