# AGENTS.md — AI Agent Instructions

## Project Overview

This is a NestJS + TypeORM monolith serving a multi-tenant SaaS platform. The codebase follows
standard NestJS module patterns with TypeORM repositories for data access.

## Architecture

- **Modules**: Each domain concern lives in its own NestJS module under `src/`
- **Entities**: TypeORM entities define the database schema with decorators
- **Services**: Business logic lives in injectable services, one per module
- **Repositories**: TypeORM repositories are injected via `@InjectRepository()` or accessed
  via `DataSource.getRepository()` for cross-module queries

## Key Patterns

### Repository Access
- Primary pattern: `@InjectRepository(Entity)` in the constructor
- Cross-module pattern: `this.dataSource.getRepository(Entity)` for accessing other module's entities
  without creating circular dependencies
- Transaction pattern: `manager.getRepository(Entity)` or `manager.create(Entity, ...)` inside
  `this.dataSource.transaction()` callbacks

### Query Building
- Simple queries: Use repository `.find()`, `.findOne()`, `.count()` methods
- Complex queries: Use `.createQueryBuilder()` for JOINs, aggregations, sub-queries
- Cross-table joins: Use `.leftJoin()` with raw table names when joining across modules

### Testing
- Spec files live next to their source files (e.g., `users.service.spec.ts`)
- Tests use Jest with placeholder assertions (mocking infrastructure TBD)
- Each service method should have a corresponding test case

### Code Organization
- Shared utilities in `src/shared/` (pagination, response wrappers, query helpers)
- DTOs defined as interfaces in the same file as the service that uses them
- Enums defined in entity files alongside the entity class

## Database

- PostgreSQL with JSONB support for flexible metadata columns
- UUIDs for all primary keys
- Soft-delete via `deletedAt` column (BaseEntity) or status field
- Indexes on frequently queried columns (see entity decorators)

## Common Tasks

When asked to extract repository patterns:
1. Create a new repository class extending TypeORM's Repository
2. Move query logic from the service into the repository
3. **IMPORTANT**: Update the service to inject and use the new repository
4. Register the repository in the module's providers
5. Add corresponding test coverage

## File Naming Conventions
- Entities: `<name>.entity.ts`
- Services: `<name>.service.ts`
- Modules: `<name>.module.ts`
- Tests: `<name>.service.spec.ts`
- Repositories: `<name>.repository.ts`
