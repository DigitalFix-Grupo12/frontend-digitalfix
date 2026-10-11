import { Component, inject } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { IconComponent } from '../../core/ui/icon.component';
import { activeTenant, saveTenantKey, tenantProfiles } from '../../core/config/app-config';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  authService = inject(AuthService);

  readonly tenants = tenantProfiles;
  readonly activeTenant = activeTenant;

  /** MSAL se inicializa con el tenant elegido al arrancar: cambiarlo recarga la app. */
  selectTenant(key: string): void {
    if (key === this.activeTenant.key) return;
    saveTenantKey(key);
    window.location.reload();
  }

  readonly features = [
    { icon: 'wrench', tone: 'amber', title: 'Órdenes en terreno', text: 'Ciclo completo: creación, asignación, ejecución y cierre.' },
    { icon: 'shield', tone: 'green', title: 'Acceso por roles', text: 'Admin, Supervisor, Cliente y Auditor con Entra ID.' },
    { icon: 'chart', tone: 'blue', title: 'KPIs de la red', text: 'Tiempos de resolución y carga por franja horaria.' },
    { icon: 'history', tone: 'violet', title: 'Trazabilidad', text: 'Cada cambio queda auditado con su responsable.' },
  ];
}
