import { Component, inject } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { IconComponent } from '../../core/ui/icon.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  authService = inject(AuthService);

  readonly features = [
    { icon: 'wrench', tone: 'amber', title: 'Órdenes en terreno', text: 'Ciclo completo: creación, asignación, ejecución y cierre.' },
    { icon: 'shield', tone: 'green', title: 'Acceso por roles', text: 'Admin, Supervisor, Cliente y Auditor con Entra ID.' },
    { icon: 'chart', tone: 'blue', title: 'KPIs de la red', text: 'Tiempos de resolución y carga por franja horaria.' },
    { icon: 'history', tone: 'violet', title: 'Trazabilidad', text: 'Cada cambio queda auditado con su responsable.' },
  ];
}
