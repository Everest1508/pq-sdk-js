# PQ SDK Agent Instruction: NestJS

## Install and configure

```bash
npm install pq-befu @nestjs/common rxjs
```

Set `PQ_API_KEY`, `PQ_BASE_URL`, and `NODE_ENV` in the server environment.

## Required integration

Add `PqSdkModule.forRoot` to the root module's `imports`. It creates a global
client and interceptor that reports 5xx exceptions, then re-throws them so
existing NestJS exception filters remain active.

```ts
import { Module } from "@nestjs/common";
import { PqSdkModule } from "pq-befu/integrations/nestjs";

@Module({
  imports: [
    PqSdkModule.forRoot({
      apiKey: process.env.PQ_API_KEY,
      baseUrl: process.env.PQ_BASE_URL || "http://localhost:8000",
      environment: process.env.NODE_ENV || "development",
    }),
  ],
})
export class AppModule {}
```

Do not remove or reorder existing exception filters or global interceptors
unless a concrete, documented conflict requires it.

## Copy/paste prompt

```text
This is a NestJS app. Follow agents/nestjs.md: add PqSdkModule.forRoot from
pq-befu/integrations/nestjs to the root module imports, passing apiKey from
PQ_API_KEY, baseUrl from PQ_BASE_URL with http://localhost:8000 fallback, and
environment from NODE_ENV with "development" fallback. Ensure @nestjs/common
and rxjs are installed. Do not remove or reorder exception filters or existing
global interceptors. Keep credentials out of client bundles, document
configuration, and run the build/tests.
```
