# Phase 1 Evaluation Report

**Total Prompts**: 30
**Passed**: 27
**Failed**: 3

| Prompt | Expected Tools | Actual Tools | Latency (ms) | Pass/Fail |
|---|---|---|---|---|
| Buy groceries | create_task | create_task | 28271 | ✅ |
| Create a task to finish the report | create_task | create_task | 26344 | ✅ |
| Update my first task to HIGH priority | update_task | list_tasks -> update_task | 40363 | ✅ |
| Complete the groceries task | complete_task | list_tasks -> complete_task | 38741 | ✅ |
| List all my tasks | list_tasks | list_tasks | 38832 | ✅ |
| What tasks are high priority? | list_tasks | list_tasks | 38562 | ✅ |
| Add a new task: call mom tomorrow | create_task | create_task | 27718 | ✅ |
| Mark the report task as done | complete_task | None | 27255 | ❌ |
| Can you show me my TODO tasks? | list_tasks | list_tasks | 38865 | ✅ |
| Change priority of call mom to URGENT | update_task | list_tasks -> update_task | 44531 | ✅ |
| Add a task | None | None | 27466 | ✅ |
| Update a task | None | None | 26537 | ✅ |
| Make it done | None | None | 26094 | ✅ |
| Create something | None | None | 47573 | ✅ |
| Change priority | None | None | 26498 | ✅ |
| List things | list_tasks | list_tasks | 39035 | ✅ |
| What should I do today? | list_tasks | list_tasks | 38896 | ✅ |
| I need help | None | None | 25872 | ✅ |
| Can you create it? | None | None | 77450 | ✅ |
| Is it completed? | None | None | 26423 | ✅ |
| Create a task to buy groceries, no wait, to buy milk | create_task | create_task | 26111 | ✅ |
| Create a high priority task and then make it low priority | create_task | None | 27797 | ❌ |
| List tasks but actually just create a new one called Sleep | create_task | create_task | 26008 | ✅ |
| Do not create any tasks, just say hello | None | None | 26002 | ✅ |
| Complete task ID 999999999999 | complete_task | None | 38857 | ❌ |
| Create a task called "Duplicate Test" | create_task | create_task | 27884 | ✅ |
| Create a task called "Duplicate Test" | create_task | create_task | 26519 | ✅ |
| Create a task called "duplicate test" | create_task | create_task | 27293 | ✅ |
| Add another task called "Duplicate Test" | create_task | create_task | 27194 | ✅ |
| Make a task named "Duplicate Test" | create_task | create_task | 52252 | ✅ |