import { Routes } from '@angular/router';
import { roleGuard } from './core/guards/role.guard';
import { authGuard, guestGuard } from './core/guards/auth.guard';

import { LoginComponent } from './pages/login/login.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { WorkordersComponent } from './pages/workorders/workorders.component';
import { WorkorderDetailComponent } from './pages/workorder-detail/workorder-detail.component';
import { CatalogComponent } from './pages/catalog/catalog.component';
import { ReportsComponent } from './pages/reports/reports.component';
import { AuditComponent } from './pages/audit/audit.component';
import { SessionComponent } from './pages/session/session.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [guestGuard], title: 'DigitalFix — Iniciar sesión' },

  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard],
    title: 'DigitalFix — Dashboard',
    data: { title: 'Dashboard' },
  },
  {
    path: 'workorders',
    component: WorkordersComponent,
    canActivate: [authGuard, roleGuard],
    title: 'DigitalFix — Órdenes de trabajo',
    data: { roles: ['Admin', 'Supervisor', 'Cliente'], title: 'Órdenes de trabajo' },
  },
  {
    path: 'workorders/:id',
    component: WorkorderDetailComponent,
    canActivate: [authGuard, roleGuard],
    title: 'DigitalFix — Detalle de orden',
    data: { roles: ['Admin', 'Supervisor', 'Cliente'], title: 'Detalle de orden' },
  },
  {
    path: 'catalog',
    component: CatalogComponent,
    canActivate: [authGuard, roleGuard],
    title: 'DigitalFix — Catálogo técnico',
    data: { roles: ['Admin', 'Supervisor'], title: 'Catálogo técnico' },
  },
  {
    path: 'reports',
    component: ReportsComponent,
    canActivate: [authGuard, roleGuard],
    title: 'DigitalFix — Reportería',
    data: { roles: ['Admin'], title: 'Reportería' },
  },
  {
    path: 'audit',
    component: AuditComponent,
    canActivate: [authGuard, roleGuard],
    title: 'DigitalFix — Auditoría',
    data: { roles: ['Admin', 'Auditor'], title: 'Auditoría' },
  },
  {
    path: 'session',
    component: SessionComponent,
    canActivate: [authGuard],
    title: 'DigitalFix — Mi sesión',
    data: { title: 'Mi sesión y token' },
  },

  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: 'dashboard' },
];
