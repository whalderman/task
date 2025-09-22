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

import {
	type TaskPriority,
	TaskPriorityTypes,
} from "./scheduler-priorities.ts";

/**
 * A signal object that allows you to communicate with a prioritized task, aborting it or changing the priority (if required) via a {@link TaskController} object.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/TaskSignal)
 */
export class TaskSignal extends AbortSignal {
	private _priority: TaskPriority = "user-visible";

	/**
	 * The priority of the signal.
	 *
	 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/TaskSignal/priority)
	 */
	get priority(): TaskPriority {
		return this._priority;
	}

	private _onprioritychange: null | ((...args: any[]) => void) = null;

	/**
	 * Fired when the priority is changed.
	 *
	 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/TaskSignal/prioritychange_event)
	 */
	set onprioritychange(callback: (...args: any[]) => void) {
		if (this._onprioritychange) {
			this.removeEventListener("prioritychange", this._onprioritychange);
		}
		this.addEventListener("prioritychange", callback);
		this._onprioritychange = callback;
	}

	/**
	 * Fired when the priority is changed.
	 *
	 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/TaskSignal/prioritychange_event)
	 */
	get onprioritychange(): null | ((...args: any[]) => void) {
		return this._onprioritychange;
	}
}

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/TaskPriorityChangeEvent/TaskPriorityChangeEvent#options) */
export interface TaskPriorityChangeEventInit extends EventInit {
	/** A string indicating the previous priority of the task. One of `"user-blocking"`, `"user-visible"`, or `"background"`. */
	previousPriority: TaskPriority;
}

/**
 * The `prioritychange` event, sent to a {@link TaskSignal} if its priority is changed.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/TaskPriorityChangeEvent)
 */
export class TaskPriorityChangeEvent extends Event {
	/**
	 * The priority of the corresponding {@link TaskSignal} _before_ this prioritychange event.
	 *
	 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/TaskPriorityChangeEvent/previousPriority)
	 */
	previousPriority: TaskPriority;

	/**
	 * Constructs a TaskPriorityChangeEvent. Events of this type are typically
	 * named 'prioritychange', which is the name used for events triggered by
	 * TaskController.setPriority().
	 */
	constructor(typeArg: string, init: TaskPriorityChangeEventInit) {
		if (!init || !TaskPriorityTypes.includes(init.previousPriority)) {
			throw new TypeError(`Invalid task priority: '${init.previousPriority}'`);
		}
		super(typeArg);
		this.previousPriority = init.previousPriority;
	}
}

/**
 * {@link TaskController} options.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/TaskController/TaskController#options)
 */
export type TaskControllerOptions = {
	/** The {@link TaskPriority} of the signal associated with this {@link TaskController}. One of `"user-blocking"`, `"user-visible"`, or `"background"`. The default is `"user-visible"`. */
	priority?: TaskPriority;
};

/**
 * A controller object that can be used to both abort and change the priority of one or more prioritized tasks.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/TaskController)
 */
export class TaskController extends AbortController {
	private isPriorityChanging_ = false;
	/** Returns a {@link TaskSignal} instance. The signal is passed to tasks so that they can be aborted or re-prioritized by the controller. */
	override signal: TaskSignal;

	constructor(init?: TaskControllerOptions) {
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
	 * Sets the priority of the controller's signal, and hence the priority of any tasks with which it is associated.
	 *
	 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/TaskController/setPriority)
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
