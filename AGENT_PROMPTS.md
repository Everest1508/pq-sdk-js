# PQ SDK Agent Instructions

Choose the file that matches the application. Each file is self-contained: it
includes installation, configuration, exact integration code, placement rules,
and a copy/paste prompt for a coding agent.

| Framework | Agent instruction file |
|---|---|
| Express | [agents/express.md](agents/express.md) |
| Fastify | [agents/fastify.md](agents/fastify.md) |
| Koa | [agents/koa.md](agents/koa.md) |
| NestJS | [agents/nestjs.md](agents/nestjs.md) |
| Electron | [agents/electron.md](agents/electron.md) |
| Browser, web worker, or Deno | [agents/browser.md](agents/browser.md) |

## Rules for every integration

- Use `PQ_API_KEY` and `PQ_BASE_URL` from configuration or the environment;
  never hardcode credentials.
- Do not include passwords, tokens, authorization headers, or full request
  bodies in reports.
- Use `captureException(err, context)` for caught `Error` objects and
  `captureError({ message, errorType, ... })` for errors without an `Error`.
- In server applications with explicit shutdown handling, call `await pq.flush()`
  before the process exits.
