# Task

Promises with prioritized background callbacks.

A Task is a Promise. It includes additional utility methods and a TaskController
for more fine-grained control over its execution. This class relies on your
JavaScript runtime having implemented the
[Prioritized Task Scheduling API](https://developer.mozilla.org/docs/Web/API/Prioritized_Task_Scheduling_API).

> [!NOTE]
> A Task will **always** be slower than the equivalent Promise. Tasks are meant
> to improve time to user interactivity, _not_ execution time. Tasks will
> default to the lowest priority available in the Scheduler API.

```js
let taskController = null;
document.querySelector("input").addEventListener(
	"input",
	(ev) => {
		const query = ev.target?.value;
		if (!query || query.length < 2) {
			return;
		}
		// abort any active request
		taskController?.abort();
		// Create a new TaskController
		taskController = new TaskController();
		// Wrap a new fetch request
		const task = Task.wrapWithController(
			taskController,
			fetch(`https://somehost/api/search?q=${query}`, taskController)
				.then((response) => response.json())
				.then((data) => {
					// Use the data
					console.log(data);
				})
				.catch((e) => {
					// Check if the error is due to an abort
					if (e.name === "AbortError") {
						console.log("Fetch request was aborted.");
					} else {
						console.error("Fetch error:", e);
					}
				}),
		);
	},
);
```

The default priority for all Task objects can be set with
`Task.defaultControllerOptions`:

```js
// lowest priority, the default for Task objects
Task.defaultControllerOptions = "background";
// middle priority, the default for the Scheduler API
Task.defaultControllerOptions = "user-visible";
// highest priority
Task.defaultControllerOptions = "user-blocking";
```

The priority of a Task and its subsequent chained Tasks (`then`, `catch`) can
also be updated at any point using the `controller` property of an active Task.

```js
const task = Task.wrap(import("some-module.js"));
console.log(task.controller.signal.priority); // "background"
// console.log(task.priority); // "background"
task.controller.setPriority("user-blocking");
// task.setPriority("user-blocking");
console.log(task.controller.signal.priority); // "user-blocking"
// console.log(task.priority); // "user-blocking"
```
