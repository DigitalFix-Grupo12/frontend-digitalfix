import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink } from '@angular/router';
import { MsalBroadcastService } from '@azure/msal-angular';
import { EventMessage, EventType, AuthenticationResult } from '@azure/msal-browser';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit, OnDestroy {
  private msalBroadcastService = inject(MsalBroadcastService);
  authService = inject(AuthService);

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    // provideAppInitializer ya corrió instance.initialize() (y
    // handleRedirectPromise() si veníamos de un login) ANTES de que este
    // componente exista, así que si hay una cuenta activa ya podemos pedir
    // roles ahora mismo -- no hace falta esperar un evento que puede haber
    // ocurrido antes de que nos suscribiéramos a él.
    if (this.authService.isLoggedIn()) {
      void this.authService.refreshRoles();
    }

    // Igual escuchamos futuros logins/logouts que ocurran DESPUÉS de que
    // el componente ya existe (ej: el usuario hace clic en "Iniciar sesión"
    // sin recargar la página completa).
    this.msalBroadcastService.msalSubject$
      .pipe(
        takeUntil(this.destroy$),
        filter((msg: EventMessage) => msg.eventType === EventType.LOGIN_SUCCESS)
      )
      .subscribe((result: EventMessage) => {
        const payload = result.payload as AuthenticationResult;
        this.authService.getActiveAccount();
        void payload;
        void this.authService.refreshRoles();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  login(): void {
    this.authService.login();
  }

  logout(): void {
    this.authService.logout();
  }
}
