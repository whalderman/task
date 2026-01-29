import { Scheduler } from "./Scheduler.ts";
import {
	TaskController,
	TaskPriorityChangeEvent,
	TaskSignal,
} from "./TaskController.ts";
export type * from "./types.d.ts";
export { Scheduler, TaskController, TaskPriorityChangeEvent, TaskSignal };

interface Globals {
	scheduler?: Scheduler;
	TaskController?: typeof TaskController;
	TaskSignal?: typeof TaskSignal;
	TaskPriorityChangeEvent?: typeof TaskPriorityChangeEvent;
}

const globals: Globals = globalThis as unknown as Globals;

if (globals.scheduler === undefined) {
	console.log("Polyfilling scheduler ...");
	globals.scheduler = new Scheduler();
}
if (globals.scheduler.yield === undefined) {
	console.log("Polyfilling scheduler.yield ...");
	globals.scheduler.yield = Scheduler.prototype.yield;
}
if (globals.TaskController === undefined) {
	console.log("Polyfilling TaskController ...");
	globals.TaskController = TaskController;
}
if (globals.TaskSignal === undefined) {
	console.log("Polyfilling TaskSignal ...");
	globals.TaskSignal = TaskSignal;
}
if (globals.TaskPriorityChangeEvent === undefined) {
	console.log("Polyfilling TaskPriorityChangeEvent ...");
	globals.TaskPriorityChangeEvent = TaskPriorityChangeEvent;
}
