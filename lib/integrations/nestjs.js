"use strict";

const { PQClient } = require("../client");
const { safeRequestContext } = require("../utils");

/**
 * NestJS integration — error tracking via an interceptor and an optional
 * dynamic module for dependency injection.
 *
 * Minimal usage (no DI):
 *   const { PqInterceptor } = require("pq-befu/integrations/nestjs");
 *   const pq = new PQClient({ apiKey: "your_key", baseUrl: "http://localhost:8000" });
 *   app.useGlobalInterceptors(new PqInterceptor(pq, { environment: "production" }));
 *
 * With DI (requires @nestjs/common and @nestjs/core):
 *   @Module({ imports: [PqSdkModule.forRoot({ apiKey: "...", baseUrl: "..." })] })
 *   export class AppModule {}
 *
 * Requires the peer dependencies `@nestjs/common` and `rxjs` to be installed
 * in your application. They are loaded lazily only when this integration is
 * actually used.
 */

const PQ_CLIENT = Symbol("PQ_CLIENT");

let _rxjs = null;
function getRxjs() {
  if (!_rxjs) {
    _rxjs = require("rxjs");
  }
  return _rxjs;
}

let _nestCommon = null;
function getNestCommon() {
  if (!_nestCommon) {
    _nestCommon = require("@nestjs/common");
  }
  return _nestCommon;
}

/**
 * NestJS interceptor that captures unhandled request exceptions (5xx).
 * Re-throws the exception so NestJS still produces the response.
 */
class PqInterceptor {
  /**
   * @param {PQClient} client
   * @param {Object} [options]
   * @param {string} [options.environment]
   * @param {Object} [options.extra]
   */
  constructor(client, options = {}) {
    this.client = client;
    this.options = options;
  }

  intercept(context, next) {
    const { catchError } = getRxjs();
    return next.handle().pipe(
      catchError((err) => {
        const status =
          typeof err && typeof err.getStatus === "function"
            ? err.getStatus()
            : 500;
        if (status >= 500) {
          const req = context.switchToHttp().getRequest();
          const ctx = safeRequestContext(req);
          this.client.captureException(err, {
            environment: this.options.environment,
            page: ctx.page,
            extra: {
              method: ctx.method,
              path: ctx.path,
              status_code: status,
              ...(this.options.extra || {}),
            },
          });
        }
        throw err;
      })
    );
  }
}

/**
 * Factory returning a new PqInterceptor, for one-liner registration.
 *
 *   app.useGlobalInterceptors(pqNestjsInterceptor(pq, { environment: "production" }));
 */
function pqNestjsInterceptor(client, options = {}) {
  return new PqInterceptor(client, options);
}

/**
 * NestJS dynamic module. Registers a global PQClient provider and a global
 * interceptor that auto-captures 5xx request errors.
 *
 *   PqSdkModule.forRoot({ apiKey: "...", baseUrl: "..." })
 */
class PqSdkModule {
  static forRoot(options = {}) {
    const { Module, APP_INTERCEPTOR } = getNestCommon();
    const client = new PQClient(options);

    // Decorate lazily so requiring this file never touches @nestjs/common.
    Module({})(PqSdkModule);

    return {
      module: PqSdkModule,
      global: true,
      providers: [
        { provide: PQ_CLIENT, useValue: client },
        {
          provide: APP_INTERCEPTOR,
          useFactory: () => new PqInterceptor(client, options),
        },
      ],
      exports: [PQ_CLIENT],
    };
  }
}

module.exports = { PqSdkModule, PqInterceptor, pqNestjsInterceptor, PQ_CLIENT };
