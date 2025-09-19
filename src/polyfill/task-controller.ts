/**
 * Copyright 2020 Google LLC
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
class TaskSignal extends AbortSignal {
	priority_: TaskPriority = "user-visible";

	/**
	 * The priority of the task, "user-visible" by default.
	 */
	get priority(): TaskPriority {
		return this.priority_;
	}

	onprioritychange_: null | ((...args: any[]) => any) = null;

	/**
	 * The callback to be called when the priority of the task changes.
	 */
	set onprioritychange(callback: (...args: any[]) => any) {
		if (this.onprioritychange_) {
			this.removeEventListener("prioritychange", this.onprioritychange_);
		}
		this.addEventListener("prioritychange", callback);
		this.onprioritychange_ = callback;
	}

	/**
	 * The callback to be called when the priority of the signal changes.
	 */
	get onprioritychange(): typeof this.onprioritychange_ {
		return this.onprioritychange_;
	}
}

/**
 * Event type used for priority change events:
 * https://wicg.github.io/scheduling-apis/#sec-task-priority-change-event.
 */
class TaskPriorityChangeEvent extends Event {
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
class TaskController extends AbortController {
	isPriorityChanging_: boolean;
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

		const priority = init.priority === undefined
			? "user-visible"
			: init.priority;
		if (!TaskPriorityTypes.includes(priority)) {
			throw new TypeError(`Invalid task priority: '${priority}'`);
		}

		/**
		 * @private
		 * @type {boolean}
		 */
		this.isPriorityChanging_ = false;

		// Morph the AbortSignal instance into a TaskSignal instance.
		this.signal = Object.setPrototypeOf(super.signal, TaskSignal.prototype);
		this.signal.priority_ = priority;
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

		const previousPriority = this.signal.priority_;
		this.signal.priority_ = priority;

		const e = new TaskPriorityChangeEvent("prioritychange", {
			previousPriority,
		});
		this.signal.dispatchEvent(e);

		this.isPriorityChanging_ = false;
	}
}

export { TaskController, TaskPriorityChangeEvent, TaskSignal };
