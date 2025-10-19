# Helios AI Project Orchestrator

This repository contains the source code for Helios, an AI project orchestrator built on the Cloudflare stack.

## API Documentation

The primary interface to Helios is through its REST API. All task-related operations are scoped to a project.

### Projects

*   **GET /api/projects**: List all projects.
*   **POST /api/projects**: Create a new project.
*   **GET /api/projects/:id**: Get a single project.
*   **PUT /api/projects/:id**: Update a project.
*   **DELETE /api/projects/:id**: Delete a project.

### Tasks

The `ProjectActor` Durable Object is the canonical interface for all task state. The worker routes requests to the appropriate actor instance based on the `projectId`.

*   **POST /api/projects/:projectId/tasks**: Create a single task.
    ```bash
    curl -X POST -H "Content-Type: application/json" -d '{ "phase": "testing", "instructions": "Write a test", "status": "TODO" }' http://localhost:8787/api/projects/PROJECT_ID/tasks
    ```

*   **POST /api/projects/:projectId/tasks/batch**: Create multiple tasks in a single request.
    ```bash
    curl -X POST -H "Content-Type: application/json" -d '{ "tasks": [{ "phase": "testing", "instructions": "Write a test", "status": "TODO" }] }' http://localhost:8787/api/projects/PROJECT_ID/tasks/batch
    ```

*   **GET /api/projects/:projectId/tasks/:taskId**: Get a single task.
    ```bash
    curl http://localhost:8787/api/projects/PROJECT_ID/tasks/TASK_ID
    ```

*   **PUT /api/projects/:projectId/tasks/:taskId**: Update a task.
    ```bash
    curl -X PUT -H "Content-Type: application/json" -d '{ "id": "TASK_ID", "project_id": "PROJECT_ID", "phase": "testing", "instructions": "Write a better test", "status": "IN_PROGRESS" }' http://localhost:8787/api/projects/PROJECT_ID/tasks/TASK_ID
    ```

*   **DELETE /api/projects/:projectId/tasks/:taskId**: Delete a task.
    ```bash
    curl -X DELETE http://localhost:8787/api/projects/PROJECT_ID/tasks/TASK_ID
    ```

*   **POST /api/projects/:projectId/tasks/:taskId/status**: Update the status of a task.
    ```bash
    curl -X POST -H "Content-Type: application/json" -d '{ "status": "DONE" }' http://localhost:8787/api/projects/PROJECT_ID/tasks/TASK_ID/status
    ```
