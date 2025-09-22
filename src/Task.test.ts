import { assertInstanceOf, assertStrictEquals } from "@std/assert";
import Task from "./Task.ts";
import "./polyfill/types.d.ts";

Deno.test("Task is instanceof Promise", async () => {
	const task = new Task<1>((resolve) => {
		setTimeout(() => resolve(1), 1);
	});
	assertInstanceOf(task, Promise);
	console.log("Awaiting task...");
	const num = await task;
	console.log("Task resolved.");
	assertStrictEquals(num, 1);
});

Deno.test("Task resolves properly", async () => {
	console.log("Awaiting task...");
	const task = await new Task<1>((resolve) => {
		resolve(1);
	});
	console.log("Task resolved.");
	assertStrictEquals(task, 1);
	console.log("Awaiting task...");
	const resolvedTask = await Task.resolve(1);
	console.log("Task resolved.");
	assertStrictEquals(resolvedTask, 1);
});

// Deno.test("Task rejects properly", async () => {
// 	await assertRejects(() => Task.reject("Expected"));
// 	await assertRejects(() =>
// 		new Task<void>((_, reject) => reject(new Error("Expected")))
// 	);
// 	await assertRejects(() => new Task<void>((_, reject) => reject("Expected")));
// });

Deno.test("Task reuses TaskController", async () => {
	const taskStep1 = new Task<number>((resolve) => {
		setTimeout(() => resolve(1), 1);
	});
	const controllerStep1 = taskStep1.controller;
	const taskStep2 = taskStep1.then(() => 2);
	const controllerStep2 = taskStep2.controller;
	assertStrictEquals(controllerStep1, controllerStep2);
	await taskStep2;
});

Deno.test("Task TaskController defaults to 'background' priority", async () => {
	const task = Task.resolve(1);
	assertStrictEquals(task.controller.signal.priority, "background");
	await task;
});
