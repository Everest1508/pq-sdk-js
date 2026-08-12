# PQ SDK Agent Prompts

Copy one of these prompts into an AI coding agent when you want it to add
`pq-befu` to an application. Replace the bracketed values before sending it.

## Universal integration

```text
Integrate the pq-befu SDK into this Node.js application for PQ Platform error
tracking, feedback, and ticketing.

First inspect the project to identify its runtime, framework, entry point, and
existing error-handling conventions. Then install pq-befu and make the smallest
production-ready change that:

- creates one PQClient using PQ_API_KEY and PQ_BASE_URL (do not hardcode
  secrets; use http://localhost:8000 only as the local default);
- sets environment from NODE_ENV, falling back to "development";
- captures unhandled server errors through the appropriate framework adapter;
- preserves existing error responses and error handlers;
- adds a graceful-shutdown flush where the process can exit immediately;
- includes one deliberate, caught-error example using captureException where it
  fits the app's conventions; and
- documents the required environment variables.

Use only public pq-befu APIs. Run the relevant tests or type checks after the
change, and summarize the files changed plus any configuration I must provide.
```

## Express

```text
Add pq-befu error tracking to this Express application. Inspect the existing
bootstrap and middleware order first. Create a shared PQClient from PQ_API_KEY
and PQ_BASE_URL, then use pqExpress from pq-befu/integrations/express.

Register its middleware before routes and its errorHandler after all routes.
Pass environment: process.env.NODE_ENV || "development". Preserve all current
Express error behavior; do not replace the app's existing error handler or send
duplicate responses. Add a graceful shutdown flush if appropriate. Do not
hardcode secrets. Update the project's environment-variable documentation and
run its relevant tests.
```

## Fastify

```text
Add pq-befu error tracking to this Fastify application. First find the main
Fastify instance and its plugin-registration sequence. Create one shared
PQClient using PQ_API_KEY and PQ_BASE_URL, then register pqFastify from
pq-befu/integrations/fastify with the client and
environment: process.env.NODE_ENV || "development".

Keep Fastify's existing error handling intact: the PQ plugin should report
server failures but must not change response serialization or status behavior.
Do not hardcode secrets. Add a shutdown flush if the app has an explicit close
path, document the environment variables, and run relevant tests.
```

## Koa

```text
Add pq-befu error tracking to this Koa application. Inspect middleware order
and existing error handling. Create a shared PQClient from PQ_API_KEY and
PQ_BASE_URL, then add pqKoa from pq-befu/integrations/koa near the start of the
middleware chain with environment: process.env.NODE_ENV || "development".

The integration must re-throw errors so Koa and the application's existing
error handler keep their current response behavior. Do not hardcode secrets.
Add a shutdown flush if applicable, document the configuration, and run
relevant tests.
```

## NestJS

```text
Integrate pq-befu into this NestJS application. Inspect how AppModule and
main.ts are structured, including existing global interceptors and exception
filters. Choose the smallest fitting approach:

- add PqSdkModule.forRoot({ apiKey, baseUrl }) to the module imports, or
- create a PQClient and register PqInterceptor globally.

Source apiKey and baseUrl from configuration or environment variables; never
hardcode them. Use environment: process.env.NODE_ENV || "development" when
using PqInterceptor. Do not alter existing exception filters, response shapes,
or global interceptor ordering without explaining why. Document required
variables and run relevant tests/build checks.
```

## Electron

```text
Add pq-befu to this Electron app for main-process and renderer error tracking.
Inspect the app bootstrap and BrowserWindow creation first. In the main process,
create a shared PQClient from PQ_API_KEY and PQ_BASE_URL and call
pqElectronMain from pq-befu/integrations/electron with
environment: process.env.NODE_ENV || "development".

For sandboxed renderers, set BrowserWindow webPreferences.preload to
require.resolve("pq-befu/preload") and use window.pq in the renderer. For an
existing custom preload, use pqElectronPreload only when it is compatible with
the app's context-isolation setup. Do not expose API keys to renderers, weaken
security settings, or hardcode secrets. Preserve existing preload behavior,
document the configuration, and run relevant tests.
```

## Browser, worker, or Deno

```text
Add PQ Platform reporting to this browser, web-worker, or Deno application
using PQBrowserClient from pq-befu/browser. Find the application's config
boundary and initialize the client with its intended public or safely injected
configuration. Use captureException for caught errors and sendFeedback or
createTicket only where the product already has those user actions.

Do not embed a secret server API key into public client code. Preserve existing
error handling and user experience, document the configuration approach, and
run relevant checks.
```

## Add a feature with PQ reporting

```text
Implement [FEATURE] in this application and add useful PQ Platform reporting
with the existing pq-befu client. Before editing, find how the app obtains its
PQClient and how it reports errors today. Capture unexpected exceptions with
captureException and include relevant non-sensitive context such as environment,
page, userRef, or request metadata.

Do not report passwords, tokens, authorization headers, full request bodies, or
other sensitive personal data. Do not swallow the original error or change the
feature's user-facing error behavior merely to report it. Add focused tests and
summarize what events will be sent.
```
