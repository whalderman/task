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
import * as SchedulerPolyfill from "./scheduler.ts";
import * as TaskControllerPolyfill from "./task-controller.ts";
import * as SchedulerYieldPolyfill from "./yield.ts";

// @ts-expect-error TypeScript does not include these global types yet.
if (typeof scheduler === "undefined") {
	console.log("Polyfilling globalThis.scheduler ...");
	// @ts-expect-error TypeScript does not include these global types yet.
	globalThis.scheduler = new SchedulerPolyfill.Scheduler();
	console.log("Polyfilling globalThis.TaskController ...");
	// @ts-expect-error TypeScript does not include these global types yet.
	globalThis.TaskController = TaskControllerPolyfill.TaskController;
	console.log("Polyfilling globalThis.TaskSignal ...");
	// @ts-expect-error TypeScript does not include these global types yet.
	globalThis.TaskSignal = TaskControllerPolyfill.TaskSignal;
	console.log("Polyfilling globalThis.TaskPriorityChangeEvent ...");
	// @ts-expect-error TypeScript does not include these global types yet.
	globalThis.TaskPriorityChangeEvent =
		TaskControllerPolyfill.TaskPriorityChangeEvent;
	console.log("Polyfill complete.");
	// @ts-expect-error TypeScript does not include these global types yet.
} else if (!scheduler.yield) {
	console.log("Polyfilling globalThis.scheduler.yield ...");
	// @ts-expect-error TypeScript does not include these global types yet.
	globalThis.scheduler.yield = SchedulerYieldPolyfill.schedulerYield;
	console.log("Polyfill complete.");
}

import { Task } from "../src/Task.ts";
export { Task } from "../src/Task.ts";
export default Task;
