# Backend Host

Runtime role:

- bootstrap the Kotlin/JVM HTTP runtime
- create `ApiContext` per request
- expose the `packages/data` persistence provider
- mount the task API Cases selected by the registry

Planned v1 cases:

- `tasks/task_create`
- `tasks/task_list`
- `tasks/task_move`
