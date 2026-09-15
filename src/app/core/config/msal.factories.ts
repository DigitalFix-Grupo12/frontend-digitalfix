import {
  IPublicClientApplication,
  PublicClientApplication,
  InteractionType,
  BrowserCacheLocation,
  LogLevel,
} from '@azure/msal-browser';
import {
  MsalGuardConfiguration,
  MsalInterceptorConfiguration,
} from '@azure/msal-angular';
import { appConfig } from './app-config';

export function MSALInstanceFactory(): IPublicClientApplication {
  return new PublicClientApplication({
    auth: {
      clientId: appConfig.azureAd.clientId,
      authority: `https://login.microsoftonline.com/${appConfig.azureAd.tenantId}`,
      redirectUri: appConfig.azureAd.redirectUri,
      postLogoutRedirectUri: appConfig.azureAd.postLogoutRedirectUri,
    },
    cache: {
      cacheLocation: BrowserCacheLocation.LocalStorage,
    },
    system: {
      loggerOptions: {
        loggerCallback: (level, message, containsPii) => {
          if (containsPii) return;
          switch (level) {
            case LogLevel.Error:
              console.error(message);
              break;
            case LogLevel.Warning:
              console.warn(message);
              break;
          }
        },
      },
    },
  });
}

export function MSALGuardConfigFactory(): MsalGuardConfiguration {
  return {
    interactionType: InteractionType.Redirect,
    authRequest: {
      scopes: [appConfig.api.scope],
    },
  };
}

export function MSALInterceptorConfigFactory(): MsalInterceptorConfiguration {
  const protectedResourceMap = new Map<string, Array<string>>();
  // Cualquier request al BFF/API Gateway se firma con el Bearer token de este scope.
  protectedResourceMap.set(`${appConfig.api.baseUrl}/*`, [appConfig.api.scope]);

  return {
    interactionType: InteractionType.Redirect,
    protectedResourceMap,
  };
}
