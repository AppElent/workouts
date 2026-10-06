---
version: 1.0.0
description: Build a repository-local application CLI from app-owned source.
---

# Application CLI

This feature is the application's user-facing CLI, separate from developer toolkit scripts. Copy the [example entry and helpers](examples/index.ts) and their sibling files/commands into an app-owned cli/runtime directory, then add a thin wrapper:

```ts
import { createCli } from './runtime/index';
const { runCli } = createCli({ appName: 'my-app' });
const result = await runCli(process.argv.slice(2), {
  writeOut: value => process.stdout.write(value),
  writeErr: value => process.stderr.write(value),
  env: process.env,
});
process.exitCode = result.exitCode;
```

Use the app's tsx runner (`"my-app": "tsx cli/index.ts"`) or build with its existing TypeScript pipeline. The runtime examples use Node built-ins and become app-owned; there is no @appelent/cli dependency. Use a reviewed runner version already compatible with the project.

Register domain commands through the commands option. Keep API/Convex calls and authorization in application services. Built-in auth/config commands handle local configuration, token status, and browser login; JSON output must keep credentials redacted.

## Browser login contract

The CLI starts a loopback callback server and opens the app's `/api/cli/auth/login` with redirect_uri and unpredictable state. The application backend authenticates the user, validates the loopback redirect destination, then redirects back with a short-lived token and the same state. Backend token issuance, permissions, and login UI remain app-owned. Validate redirect scheme, loopback host, callback path, and port policy to avoid turning login into an arbitrary redirect/token exfiltration endpoint.

The callback validates state and reports denial/timeouts. Do not log credential-bearing callback URLs or include tokens in issue reports. Configuration directory selection follows the app name and supports an APPNAME_CONFIG_DIR override; use a temporary directory for tests. Token transport in a URL and file-based credential storage are inherited behavior to review before broader distribution; neither constitutes an OAuth implementation by itself.

Smoke checks should cover help, redacted config output, and auth status without using personal credentials. For GitHub Actions, put a runner.temp-based config override on the execution step, not a job-level env expression. Exercise loopback login success, wrong state, backend error, timeout, and launcher failure with a local fixture backend.

## Migration

For Workouts or another existing consumer, inventory package imports and copy the corresponding tested helpers/domain command integration into cli/. Preserve its app name, configuration location, backend contract, and user-visible commands. Test before removing @appelent/cli. Do not publish a new application package merely to get a repository-local command working.
