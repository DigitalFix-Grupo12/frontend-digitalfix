import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  it('alterna entre oscuro y claro y lo aplica al documento', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    const svc = new ThemeService();
    expect(svc.theme()).toBe('dark');
    svc.toggle();
    expect(svc.theme()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    svc.toggle();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
