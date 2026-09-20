# Phase 1 Evaluation Report

**Total Prompts**: 30
**Passed**: 0
**Failed**: 30

| Prompt | Expected Tools | Actual Tools | Latency (ms) | Pass/Fail |
|---|---|---|---|---|
| Buy groceries | create_task | None | 4033 | ❌ |
| Create a task to finish the report | create_task | None | 5199 | ❌ |
| Update my first task to HIGH priority | update_task | None | 4382 | ❌ |
| Complete the groceries task | complete_task | None | 4312 | ❌ |
| List all my tasks | list_tasks | None | 479 | ❌ |
| What tasks are high priority? | list_tasks | None | 369 | ❌ |
| Add a new task: call mom tomorrow | create_task | None | 272 | ❌ |
| Mark the report task as done | complete_task | None | 373 | ❌ |
| Can you show me my TODO tasks? | list_tasks | None | 305 | ❌ |
| Change priority of call mom to URGENT | update_task | None | 365 | ❌ |
| Add a task | None | None | 268 | ❌ |
| Update a task | None | None | 382 | ❌ |
| Make it done | None | None | 276 | ❌ |
| Create something | None | None | 368 | ❌ |
| Change priority | None | None | 288 | ❌ |
| List things | list_tasks | None | 367 | ❌ |
| What should I do today? | list_tasks | None | 289 | ❌ |
| I need help | None | None | 363 | ❌ |
| Can you create it? | None | None | 304 | ❌ |
| Is it completed? | None | None | 383 | ❌ |
| Create a task to buy groceries, no wait, to buy milk | create_task | None | 389 | ❌ |
| Create a high priority task and then make it low priority | create_task | None | 388 | ❌ |
| List tasks but actually just create a new one called Sleep | create_task | None | 334 | ❌ |
| Do not create any tasks, just say hello | None | None | 282 | ❌ |
| Complete task ID 999999999999 | complete_task | None | 359 | ❌ |
| Create a task called "Duplicate Test" | create_task | None | 293 | ❌ |
| Create a task called "Duplicate Test" | create_task | None | 388 | ❌ |
| Create a task called "duplicate test" | create_task | None | 263 | ❌ |
| Add another task called "Duplicate Test" | create_task | None | 395 | ❌ |
| Make a task named "Duplicate Test" | create_task | None | 278 | ❌ |