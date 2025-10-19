-- Migration number: 0000 	 2023-10-31T12:00:00.000Z

CREATE TABLE Projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('PENDING', 'PLANNING', 'EXECUTING', 'COMPLETED')),
    config JSON NOT NULL
);

CREATE TABLE Tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    phase TEXT NOT NULL,
    instructions TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('TODO', 'IN_PROGRESS', 'BLOCKED', 'REVIEW', 'DONE')),
    agent TEXT,
    logs TEXT,
    FOREIGN KEY (project_id) REFERENCES Projects(id) ON DELETE CASCADE
);

CREATE TABLE KnowledgeBase (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    technology TEXT NOT NULL,
    pattern TEXT NOT NULL,
    content TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES Projects(id) ON DELETE CASCADE
);
