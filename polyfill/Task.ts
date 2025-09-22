/**
 * Copyright 2021-2023 Google LLC, 2025 Warren Halderman
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { Scheduler } from "./scheduler.ts";
import {
	TaskController,
	TaskPriorityChangeEvent,
	TaskSignal,
} from "./task-controller.ts";
import { schedulerYield } from "./yield.ts";

if (typeof globalThis.scheduler === "undefined") {
	console.log("Importing polyfills for Prioritized Task Scheduling API ...");
	console.log("Polyfilling globalThis.scheduler ...");
	globalThis.scheduler = new Scheduler();
	console.log("Polyfilling globalThis.TaskController ...");
	globalThis.TaskController = TaskController;
	console.log("Polyfilling globalThis.TaskSignal ...");
	globalThis.TaskSignal = TaskSignal;
	console.log("Polyfilling globalThis.TaskPriorityChangeEvent ...");
	globalThis.TaskPriorityChangeEvent = TaskPriorityChangeEvent;
	console.log("Polyfill complete.");
} else if (!globalThis.scheduler.yield) {
	console.log("Importing polyfill for globalThis.scheduler.yield ...");
	console.log("Polyfilling globalThis.scheduler.yield ...");
	globalThis.scheduler.yield = schedulerYield;
	console.log("Polyfill complete.");
}

import "../types.d.ts";

import { Task } from "../src/Task.ts";
export { Task } from "../src/Task.ts";
export default Task;
