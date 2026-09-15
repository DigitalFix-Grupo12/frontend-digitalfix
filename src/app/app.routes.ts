import { Routes } from '@angular/router';
import { MsalGuard } from '@azure/msal-angular';
import { roleGuard } from './core/guards/role.guard';

import { LoginComponent } from './pages/login/login.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { WorkordersComponent } from './pages/workorders/workorders.component';
import { CatalogComponent } from './pages/catalog/catalog.component';
import { ReportsComponent } from './pages/reports/reports.component';
import { AuditComponent } from './pages/audit/audit.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },

  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [MsalGuard],
  },
  {
    path: 'workorders',
    component: WorkordersComponent,
    canActivate: [MsalGuard, roleGuard],
    data: { roles: ['Admin', 'Supervisor', 'Cliente'] },
  },
  {
    path: 'catalog',
    component: CatalogComponent,
    canActivate: [MsalGuard, roleGuard],
    data: { roles: ['Admin', 'Supervisor'] },
  },
  {
    path: 'reports',
    component: ReportsComponent,
    canActivate: [MsalGuard, roleGuard],
    data: { roles: ['Admin'] },
  },
  {
    path: 'audit',
    component: AuditComponent,
    canActivate: [MsalGuard, roleGuard],
    data: { roles: ['Admin', 'Auditor'] },
  },

  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: 'dashboard' },
];
