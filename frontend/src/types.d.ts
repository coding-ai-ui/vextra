import 'react';
import 'axios';

declare module 'react' {
  interface CSSProperties {
    [property: `--${string}`]: string | number | undefined;
  }
}

declare module 'axios' {
  interface AxiosRequestConfig<D = any, P = any> {
    skipAuth?: boolean;
    skipRefresh?: boolean;
    _sessionVersion?: number;
    _retry?: boolean;
  }
}
