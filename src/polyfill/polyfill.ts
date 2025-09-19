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

export async function importPolyfillIfNecessary() {
	if (typeof self.scheduler === "undefined") {
		console.log("Importing polyfills for Prioritized Task Scheduling API ...");
		const [
			{ Scheduler },
			{ TaskController, TaskSignal, TaskPriorityChangeEvent },
		] = await Promise.all([
			import("./scheduler.ts"),
			import("./task-controller.ts"),
		]);
		console.log("Polyfilling self.scheduler ...");
		self.scheduler = new Scheduler();
		console.log("Polyfilling self.TaskController ...");
		self.TaskController = TaskController;
		console.log("Polyfilling self.TaskSignal ...");
		self.TaskSignal = TaskSignal;
		console.log("Polyfilling self.TaskPriorityChangeEvent ...");
		self.TaskPriorityChangeEvent = TaskPriorityChangeEvent;
		console.log("Polyfill complete.");
	} else if (!self.scheduler.yield) {
		console.log("Importing polyfill for self.scheduler.yield ...");
		const { schedulerYield } = await import("./yield.ts");
		console.log("Polyfilling self.scheduler.yield ...");
		self.scheduler.yield = schedulerYield;
		console.log("Polyfill complete.");
	}
}
