# Architecture Overview

## Module Dependency Graph

```
AppModule
├── UsersModule (core user management + profile cross-refs)
├── ItemsModule (user-owned items/content)
├── ProfilesModule (extended user profile data)
├── NotificationsModule (in-app notification system)
├── PaymentsModule (payment processing + history)
├── TeamsModule (team/org management with memberships)
└── ActivityLogModule (audit trail for all entities)
```

## Database Schema

### Core Tables
- `users` — core user accounts
- `profiles` — extended profile info (1:1 with users)
- `items` — user-created content items

### Collaboration Tables
- `teams` — team/organization entities
- `team_members` — many-to-many team membership with roles

### System Tables
- `notifications` — in-app notifications
- `payments` — payment transactions
- `activity_logs` — audit trail

## Cross-Module Data Access

Services that need data from other modules use `DataSource.getRepository()` to avoid
circular module dependencies. This is a deliberate architectural choice — see UsersService
for examples of cross-module Profile access.

## Query Patterns

1. **Simple CRUD**: Repository methods (`.find()`, `.save()`, etc.)
2. **Complex Queries**: QueryBuilder with typed results
3. **Cross-Module Joins**: Raw SQL joins via QueryBuilder
4. **Transactions**: `DataSource.transaction()` with EntityManager
5. **Aggregations**: `.getRawMany()` with `SELECT ... GROUP BY`
