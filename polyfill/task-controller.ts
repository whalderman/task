/**
 * Copyright 2020 Google LLC, 2025 Warren Halderman
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

import { TaskPriorityTypes } from "./scheduler-priorities.ts";

/**
 * The TaskSignal interface represents a signal object that allows you to
 * communicate with a prioritized task, and abort it or change the priority
 * via a TaskController object.
 */
export class TaskSignal extends AbortSignal {
	private _priority: TaskPriority = "user-visible";

	/**
	 * The priority of the task, "user-visible" by default.
	 */
	get priority(): TaskPriority {
		return this._priority;
	}

	private _onprioritychange: null | ((...args: any[]) => void) = null;

	/**
	 * The callback to be called when the priority of the task changes.
	 */
	set onprioritychange(callback: (...args: any[]) => void) {
		if (this._onprioritychange) {
			this.removeEventListener("prioritychange", this._onprioritychange);
		}
		this.addEventListener("prioritychange", callback);
		this._onprioritychange = callback;
	}

	/**
	 * The callback to be called when the priority of the signal changes.
	 */
	get onprioritychange(): null | ((...args: any[]) => void) {
		return this._onprioritychange;
	}
}

/**
 * Event type used for priority change events:
 * https://wicg.github.io/scheduling-apis/#sec-task-priority-change-event.
 */
export class TaskPriorityChangeEvent extends Event {
	previousPriority: TaskPriority;

	/**
	 * Constructs a TaskPriorityChangeEvent. Events of this type are typically
	 * named 'prioritychange', which is the name used for events triggered by
	 * TaskController.setPriority().
	 */
	constructor(typeArg: string, init: { previousPriority: TaskPriority }) {
		if (!init || !TaskPriorityTypes.includes(init.previousPriority)) {
			throw new TypeError(`Invalid task priority: '${init.previousPriority}'`);
		}
		super(typeArg);
		this.previousPriority = init.previousPriority;
	}
}

/**
 * TaskController enables changing the priority of tasks associated with its
 * TaskSignal.
 */
export class TaskController extends AbortController {
	private isPriorityChanging_ = false;
	override signal: TaskSignal;

	/**
	 * @param {{priority: TaskPriority}} init
	 */
	constructor(init?: { priority?: TaskPriority }) {
		super();

		if (!init) init = {};
		if (typeof init !== "object") {
			throw new TypeError(`'init' is not an object`);
		}

		const priority = !init.priority ? "user-visible" : init.priority;
		if (!TaskPriorityTypes.includes(priority)) {
			throw new TypeError(`Invalid task priority: '${priority}'`);
		}

		// Morph the AbortSignal instance into a TaskSignal instance.
		this.signal = Object.setPrototypeOf(super.signal, TaskSignal.prototype);
		Object.defineProperty(this.signal, "_priority", {
			configurable: false,
			enumerable: false,
			writable: true,
			value: priority,
		});
	}

	/**
	 * Change the priority of all tasks associated with this controller's signal.
	 */
	setPriority(priority: TaskPriority) {
		if (!TaskPriorityTypes.includes(priority)) {
			throw new TypeError("Invalid task priority: " + priority);
		}
		if (this.isPriorityChanging_) throw new DOMException("", "NotAllowedError");
		if (this.signal.priority === priority) return;

		this.isPriorityChanging_ = true;

		const previousPriority = this.signal.priority;
		Object.defineProperty(this.signal, "_priority", {
			configurable: false,
			enumerable: false,
			writable: true,
			value: priority,
		});

		const e = new TaskPriorityChangeEvent("prioritychange", {
			previousPriority,
		});
		this.signal.dispatchEvent(e);

		this.isPriorityChanging_ = false;
	}
}
