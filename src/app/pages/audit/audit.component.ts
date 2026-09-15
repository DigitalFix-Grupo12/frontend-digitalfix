import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { appConfig } from '../../core/config/app-config';

interface AuditEvent { id: number; usuario: string; accion: string; fecha: string; }

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './audit.component.html',
})
export class AuditComponent implements OnInit {
  private http = inject(HttpClient);
  events = signal<AuditEvent[]>([]);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.http.get<AuditEvent[]>(`${appConfig.api.baseUrl}/api/audit`).subscribe({
      next: (data) => this.events.set(data),
      error: (err) => this.error.set(`HTTP ${err.status}`),
    });
  }
}
