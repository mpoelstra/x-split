import { InjectionToken } from '@angular/core';
import { AppEnvironment } from './app-environment';

export const APP_ENV = new InjectionToken<AppEnvironment>('APP_ENV');
