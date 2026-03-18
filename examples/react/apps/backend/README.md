# Backend Host

Runtime role:

- bootstrap the Node HTTP runtime
- create `ApiContext` per request
- expose the `packages/data` persistence provider
- mount the task API cases selected by the registry

Structural status:

- registry created
- Node server entrypoint created
- health and manifest routes created
- task API Cases mounted and validated

Planned v1 cases:

- `tasks/task_create`
- `tasks/task_list`
- `tasks/task_move`
