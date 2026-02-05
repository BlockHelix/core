declare module '@x402/express' {
  import { Request, Response, NextFunction } from 'express';

  export function paymentMiddleware(
    routes: import('@x402/core/server').RoutesConfig,
    server: import('@x402/core/server').x402ResourceServer,
    paywallConfig?: any,
    paywall?: any,
    syncFacilitatorOnStart?: boolean,
  ): (req: Request, res: Response, next: NextFunction) => Promise<void>;

  export { x402ResourceServer, RouteConfig, RoutesConfig } from '@x402/core/server';
}

declare module '@x402/core/server' {
  export class HTTPFacilitatorClient {
    constructor(config?: { url?: string });
    verify(paymentPayload: any, paymentRequirements: any): Promise<any>;
    settle(paymentPayload: any, paymentRequirements: any): Promise<any>;
    getSupported(): Promise<any>;
  }

  export interface PaymentOption {
    scheme: string;
    payTo: string;
    price: string | number;
    network: string;
    maxTimeoutSeconds?: number;
    extra?: Record<string, unknown>;
  }

  export interface RouteConfig {
    accepts: PaymentOption | PaymentOption[];
    resource?: string;
    description?: string;
    mimeType?: string;
  }

  export type RoutesConfig = Record<string, RouteConfig>;

  export class x402ResourceServer {
    constructor(facilitatorClients?: any);
    register(network: string, server: any): x402ResourceServer;
  }
}

declare module '@x402/svm/exact/server' {
  export class ExactSvmScheme {
    readonly scheme: string;
    registerMoneyParser(parser: any): ExactSvmScheme;
    parsePrice(price: any, network: any): Promise<any>;
  }

  export function registerExactSvmScheme(
    server: import('@x402/core/server').x402ResourceServer,
    config?: { networks?: string[] },
  ): import('@x402/core/server').x402ResourceServer;
}
