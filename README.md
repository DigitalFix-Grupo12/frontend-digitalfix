# frontend-digitalfix

[![CI](https://github.com/DigitalFix-Grupo12/frontend-digitalfix/actions/workflows/ci.yml/badge.svg)](https://github.com/DigitalFix-Grupo12/frontend-digitalfix/actions/workflows/ci.yml)

SPA Angular 22 (standalone, zoneless) de DigitalFix. Login corporativo con **Microsoft Entra ID**
mediante **MSAL** (OAuth 2.0 / OpenID Connect, Authorization Code + PKCE) y consumo del backend a través de
**AWS API Gateway** → `ms-digitalfix-bff`. El `MsalInterceptor` adjunta el access token (JWT) a cada llamada.

Publicado en AWS Amplify: https://main.dehlzhnwtqj7a.amplifyapp.com

## Pantallas y roles

| Ruta | Pantalla | Roles |
|---|---|---|
| `/login` | Inicio de sesión con Microsoft | público |
| `/dashboard` | Resumen según rol | autenticados |
| `/workorders`, `/workorders/:id` | Órdenes de trabajo (tablero por estado, detalle con historial) | Admin, Supervisor, Cliente |
| `/catalog` | Catálogo técnico | Admin, Supervisor |
| `/reports` | KPIs **en vivo** (refresco cada 4 s desde la proyección Kafka de report): eventos consumidos con partición/offset, consumo por partición del grupo `report-kpis` y órdenes con SLA en riesgo | Admin |
| `/audit` | Timeline de auditoría (Kafka `workorders.events` + `audit.timeline`): rol, IP de origen, accesos denegados, partición y offset | Admin, Auditor |
| `/messaging` | **Mensajería RabbitMQ**: clúster, colas y DLQ, exchanges, bindings, publicación de prueba y reproceso | Admin |
| `/streaming` | **Streaming Kafka**: brokers, tópicos (líder, réplicas, ISR, offsets, retención), crear tópico, cambiar configuración, aumentar particiones, consumer groups con lag por partición y reset de offsets | Admin |
| `/session` | Claims del token y probador de rutas 200/401/403 | autenticados |

Las rutas privadas usan `authGuard` (sesión MSAL) y `roleGuard` (App Roles del claim `roles`).
El backend vuelve a validar el rol: ocultar un menú no es el control de seguridad.

## Estructura

```
src/app/
├── core/
│   ├── config/      app-config.ts (tenant, clientId, scope, URL del gateway) · msal.factories.ts
│   ├── guards/      authGuard · roleGuard
│   ├── services/    auth · api · workorders · rabbit-admin · toast
│   ├── components/  toast-tray
│   └── ui/          icon (SVG inline) · format (fechas, estados, errores)
└── pages/           login · dashboard · workorders · workorder-detail · catalog · reports · audit · messaging · streaming · session
```

## Desarrollo

Requisitos: Node 22.22+ o 24, Angular CLI 22.

```bash
npm ci
ng serve          # http://localhost:4200 (registrado como Redirect URI en Entra ID)
ng build          # build de producción en dist/
ng test           # tests unitarios con Vitest
```

`app-config.ts` apunta al API Gateway de AWS. Para probar contra un BFF local, cambiar `api.baseUrl` a
`http://localhost:8080`.

## Despliegue

`digitalfix-infra/scripts/Deploy-Frontend.ps1`: `ng build` + publicación en AWS Amplify con rewrite SPA.
