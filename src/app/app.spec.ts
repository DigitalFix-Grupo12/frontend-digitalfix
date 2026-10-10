import { routes } from './app.routes';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

/** Contrato de navegación: rutas privadas protegidas y roles por pantalla. */
describe('Rutas de la aplicación', () => {
  const byPath = (path: string) => routes.find((r) => r.path === path);

  it('Mensajería solo es accesible para el rol Admin', () => {
    const r = byPath('messaging');
    expect(r?.canActivate).toEqual([authGuard, roleGuard]);
    expect(r?.data?.['roles']).toEqual(['Admin']);
  });

  it('toda ruta con componente, excepto login, exige sesión', () => {
    const privadas = routes.filter((r) => r.component && r.path !== 'login');
    expect(privadas.length).toBeGreaterThan(5);
    for (const r of privadas) {
      expect(r.canActivate ?? []).toContain(authGuard);
    }
  });

  it('las rutas desconocidas vuelven al dashboard', () => {
    expect(byPath('**')?.redirectTo).toBe('dashboard');
  });
});
