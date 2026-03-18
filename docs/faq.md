# FAQ

## Is APP a framework?

No.
APP is a protocol, not a framework or runtime library.

## What is the difference between APP and `/app`?

APP is the protocol baseline.
`/app` is the canonical operational profile used by agents in APP projects.

## Do I need every surface in every Case?

No.
Each Case exposes only the surfaces it actually needs.

## Do Cases import each other?

No.
Cross-case orchestration happens through `ctx.cases`.

## Do Cases import `packages/` directly?

No.
Cases consume host-selected shared packages through `ctx.packages`.

## Is `domain.validate()` called automatically?

No.
Domain artifacts are consumed manually by other surfaces.

## Is `agentic.case.ts` mandatory?

No in baseline APP.
Yes only when a Case chooses to expose an agentic surface.

## Is `agentic.case.ts` enough to make an app agentic?

No.
It makes a Case agent-operable, but app-level agentic conformance also requires
an agent host that publishes and governs those surfaces across HTTP and MCP.

## Is `chatbot` the canonical host name for an agentic app?

No.
The canonical generic host name is `agent`.
`chatbot` may still be used when the host is explicitly a conversational
specialization.

## Is `test()` mandatory?

In baseline APP, `test()` is strongly recommended.
In the `/app` operational profile, it is required on touched surfaces.

## Is `<case>.us.md` mandatory?

In baseline APP, no.
In `/app`, yes for new Cases, new surfaces, and semantic changes.

## Can APP standardize `auth`, `db`, and `queue`?

APP deliberately leaves those host-defined.
The protocol only standardizes minimal integration interfaces where convergence is useful.

## Does publishing on npm make the skill appear in every host automatically?

No.
Publishing on npm makes the package installable.
Hosts discover the skill after it is installed into the correct skill directory.

## Does pushing to `main` publish to npm automatically?

No.
The current release workflow publishes on `v*` tags or manual dispatch.

## Can I install without npm?

Yes.
You can install from the GitHub Release tarball.

## Where should I start if I am new?

Start with:

- [`getting-started.md`](./getting-started.md)
- [`protocol-overview.md`](./protocol-overview.md)
- [`installing-app-skill.md`](./installing-app-skill.md)
