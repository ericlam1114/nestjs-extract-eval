# API Development Guide

## Adding a New Endpoint

1. Define the DTO interface in the service file
2. Implement the business logic in the service
3. Create or update the controller
4. Add validation decorators (class-validator)
5. Write tests for the service method

## Error Handling

Use NestJS built-in exceptions:
- `NotFoundException` — entity not found (404)
- `ConflictException` — duplicate key or state conflict (409)
- `BadRequestException` — invalid input (400)
- `ForbiddenException` — authorization failure (403)

## Pagination

Use the shared `PaginationDto` from `src/shared/pagination.dto.ts`:

```typescript
import { PaginationDto, buildPaginatedResponse } from '../shared';

async listItems(pagination: PaginationDto) {
  const [data, total] = await this.itemRepository.findAndCount({
    skip: pagination.offset,
    take: pagination.limit,
    order: { [pagination.sortBy]: pagination.sortOrder },
  });
  return buildPaginatedResponse(data, total, pagination);
}
```

## Testing

All service methods should have corresponding spec file tests.
Use Jest's `describe/it` blocks with descriptive test names.
Mock repositories using `jest.fn()` or `@nestjs/testing` utilities.
