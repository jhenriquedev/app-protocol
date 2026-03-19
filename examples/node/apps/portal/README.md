# Portal App

This host materializes the APP UI runtime for the Node task board example.

Responsibilities:

- expose the `ui` surfaces registered in `_cases`
- expose the HTML render helpers through `_packages.designSystem`
- delegate data access to the backend API through `ctx.api`
- keep runtime composition in the host, not in the Cases
