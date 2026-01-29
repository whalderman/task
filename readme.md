# Task

Promises with prioritized background callbacks.

## Install

```sh
deno add jsr:@apt/task

pnpm i jsr:@apt/task
# pnpm dlx jsr add @apt/task

yarn add jsr:@apt/task
# yarn dlx jsr add @apt/task

vlt install jsr:@apt/task

npx jsr add @apt/task

bunx jsr add @apt/task
```

## Usage

> [!IMPORTANT]
> Runtimes without the Prioritized Task Scheduling API will need to import a
> polyfill. A modified version of a polyfill from the Google Chrome team is
> included in this package. Supported browsers and runtimes can be reviewed with
> the link above.
>
> The polyfill **must** be imported before the main library.

```js
// import polyfill
import "@apt/task/polyfill";

// import library
import Task from "@apt/task";
```

## What

A Task is a Promise. It includes additional utility methods and a TaskController
for more fine-grained control over its execution. This class relies on your
JavaScript runtime having implemented the
[Prioritized Task Scheduling API](https://developer.mozilla.org/docs/Web/API/Prioritized_Task_Scheduling_API).

## Why

Tasks are meant to improve time to user interactivity, _not_ execution time.
Tasks will default to the lowest priority available in the Scheduler API.

> [!NOTE]
> A Task will **always** be slower than the equivalent Promise.

## How

```js
// import modules in the background
const cm = {
	autocomplete: Task.wrap(import("@codemirror/autocomplete")),
	commands: Task.wrap(import("@codemirror/commands")),
	lang_json: Task.wrap(import("@codemirror/lang-json")),
	language: Task.wrap(import("@codemirror/language")),
	lint: Task.wrap(import("@codemirror/lint")),
	search: Task.wrap(import("@codemirror/search")),
	state: Task.wrap(import("@codemirror/state")),
	view: Task.wrap(import("@codemirror/view")),
};

// Run some analyses sequentially
const analyses = [];
Task.run(async function awaitAnalyses() {
	for await (const analysis of generator) {
		analyses.push(analysis);
		// yield back to the main thread after each analysis.
		await scheduler.yield();
	}
});

// etc.
```

The default priority for all Task objects can be set with
`Task.defaultPriority`:

```js
// low priority (default)
Task.defaultPriority = "background";
// base priority
Task.defaultPriority = "user-visible";
// high priority
Task.defaultPriority = "user-blocking";
```

The priority of a Task and its subsequent chained Tasks (`then`, `catch`) can
also be updated at any point:

```js
const task = Task.wrap(import("some-module.js"));
console.log(task.priority); // "background"
// console.log(task.priority); // "background"
task.setPriority("user-blocking");
// task.setPriority("user-blocking");
console.log(task.priority); // "user-blocking"
// console.log(task.priority); // "user-blocking"
```
