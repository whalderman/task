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

import { HostCallback } from "./host-callback.ts";
import { IntrusiveTaskQueue as TaskQueue } from "./intrusive-task-queue.ts";
import { TaskPriorityTypes } from "./scheduler-priorities.ts";

export class SchedulerTask {
	callback: (...args: any[]) => void;
	options: SchedulerPostTaskOptions;

	/** The resolve function from the associated Promise. */
	// @ts-expect-error assigned synchronously in Promise above.
	resolve: (value: any) => void;

	/** The reject function from the associated Promise. */
	// @ts-expect-error assigned synchronously in Promise above.
	reject: (reason?: any) => void;

	/** The pending HostCallback, which is set iff this is a delayed task. */
	hostCallback: null | HostCallback = null;

	/**
	 * The callback passed to the abort event listener, which calls
	 * `onAbort` and is bound to this task via an => function.
	 */
	abortCallback: null | (() => void) = null;

	isContinuation: boolean;

	promise: Promise<any>;

	private id: number | undefined;
	get sequenceId() {
		if (!this.id) throw new Error("sequenceId has not been set!");
		return this.id;
	}
	set sequenceId(n) {
		this.id = n;
	}

	/**
	 * The previous task.
	 */
	prev: null | SchedulerTask = null;
	/**
	 * The next task.
	 */
	next: null | SchedulerTask = null;

	constructor(
		callback: (...args: any[]) => void,
		options: SchedulerPostTaskOptions,
		isContinuation: boolean = false,
	) {
		this.callback = callback;
		this.options = options;
		this.isContinuation = isContinuation;
		this.promise = new Promise((resolve, reject) => {
			this.resolve = resolve;
			this.reject = reject;
		});
	}

	onTaskCompleted() {
		if (!this.options.signal || !this.abortCallback) return;
		this.options.signal.removeEventListener("abort", this.abortCallback);
		this.abortCallback = null;
	}

	onTaskAborted() {
		// If this is a delayed task that hasn't expired yet, cancel the host
		// callback.
		if (this.hostCallback) {
			this.hostCallback.cancel();
			this.hostCallback = null;
		}
		this.options.signal!.removeEventListener("abort", this.abortCallback!);
		this.abortCallback = null;
		this.reject(this.options.signal!.reason);
	}

	isAborted() {
		return this.options.signal && this.options.signal.aborted;
	}
}

/**
 * Polyfill of the scheduler API: https://wicg.github.io/scheduling-apis/.
 */
export class Scheduler {
	/**
	 * Continuation and task queue for each priority, in that order.
	 */
	private queues = {} as Record<TaskPriority, [TaskQueue, TaskQueue]>;
	/*
	 * We only schedule a single host callback, which can be a setTimeout,
	 * requestIdleCallback, or postMessage, which will run the oldest, highest
	 * priority task.
	 *
	 * TODO(shaseley): consider an option for supporting multiple outstanding
	 * callbacks, which more closely matches the current Chromium
	 * implementation.
	 */
	private pendingHostCallback: null | HostCallback = null;
	/**
	 * This keeps track of signals we know about for priority changes. The
	 * entries are (key = signal, value = current priority). When we encounter
	 * a new TaskSignal (an AbortSignal with a priority property), we listen for
	 * priority changes so we can move tasks between queues accordingly.
	 */
	private signals = new WeakMap<AbortSignal, TaskPriority>();

	/**
	 * Constructs a Scheduler object. There should only be one Scheduler per page
	 * since tasks are only run in priority order within a particular scheduler.
	 */
	constructor() {
		for (const priority of TaskPriorityTypes) {
			this.queues[priority] = [new TaskQueue(), new TaskQueue()];
		}
	}

	/**
	 * Returns a promise that is resolved in a new task.
	 *
	 * @return {!Promise<*>}
	 */
	yield(): Promise<any> {
		// Inheritance is not supported. Use default options instead.
		return this.postTaskOrContinuation(
			() => {},
			{ priority: "user-visible" },
			true,
		);
	}

	/**
	 * Schedules `callback` to be run asynchronously, returning a promise that is
	 * resolved with the callback's result when it finishes running. The resulting
	 * promise is rejected if the callback throws an exception, or if the
	 * associated signal is aborted.
	 */
	postTask(
		callback: () => any,
		options?: SchedulerPostTaskOptions,
	): Promise<any> {
		return this.postTaskOrContinuation(callback, options, false);
	}

	/**
	 * Common scheduling logic for postTask and yield.
	 */
	async postTaskOrContinuation(
		callback: () => any,
		options?: SchedulerPostTaskOptions,
		isContinuation: boolean = false,
	): Promise<any> {
		// Make a copy since we modify some of the options.
		options = Object.assign({}, options);

		if (options.signal !== undefined) {
			// Non-numeric options cannot be null for this API. Also make sure we can
			// use this object as an AbortSignal.
			if (
				options.signal === null || !("aborted" in options.signal) ||
				typeof options.signal.addEventListener !== "function"
			) {
				throw new TypeError(`'signal' is not a valid 'AbortSignal'`);
			}
			// If this is a TaskSignal, make sure the priority is valid.
			if (
				options.signal && "priority" in options.signal &&
				!TaskPriorityTypes.includes(options.signal.priority)
			) {
				throw new TypeError(
					`Invalid task priority: '${options.signal.priority}'`,
				);
			}
		}

		if (options.priority !== undefined) {
			// Non-numeric options cannot be null for this API.
			if (
				options.priority === null ||
				!TaskPriorityTypes.includes(options.priority)
			) {
				throw new TypeError(`Invalid task priority: '${options.priority}'`);
			}
		}

		if (options.delay === undefined) options.delay = 0;
		// Unlike setTimeout, postTask uses [EnforceRange] and rejects negative
		// delay values. But it also converts non-numeric values to numbers. Since
		// IDL and Number() both use the same underlying ECMAScript algorithm
		// (ToNumber()), convert the value using Number(delay) and then check the
		// range.
		options.delay = Number(options.delay);
		if (options.delay < 0) {
			throw new TypeError(`'delay' must be a positive number.`);
		}

		const task = new SchedulerTask(
			callback,
			options,
			isContinuation,
		);

		this.schedule(task);

		return await task.promise;
	}

	private schedule(task: SchedulerTask) {
		// Handle tasks that have already been aborted or might be aborted in the
		// future.
		const signal = task.options.signal;
		if (signal) {
			if (signal.aborted) {
				task.reject(signal.reason);
				return;
			}

			task.abortCallback = () => {
				task.onTaskAborted();
			};
			signal.addEventListener("abort", task.abortCallback);
		}

		// Handle delayed tasks.
		if (task.options.delay && task.options.delay > 0) {
			task.hostCallback = new HostCallback(
				() => {
					task.hostCallback = null;
					this.onTaskDelayExpired(task);
				},
				null, /* priority */
				task.options.delay,
			);
			return;
		}

		this.pushTask(task);
		this.scheduleHostCallbackIfNeeded();
	}

	/**
	 * Callback invoked when a delayed task's timeout expires.
	 * @private
	 * @param {!Object} task
	 */
	onTaskDelayExpired(task: SchedulerTask) {
		// We need to queue the task in the appropriate queue, most importantly
		// to ensure ordering guarantees.
		this.pushTask(task);

		// We also use this as an entrypoint into the scheduler and run the
		// next task, rather than waiting for the pending callback or scheduling
		// another one.
		if (this.pendingHostCallback) {
			this.pendingHostCallback.cancel();
			this.pendingHostCallback = null;
		}
		this.schedulerEntryCallback();
	}

	/**
	 * Callback invoked when a prioritychange event is raised for `signal`.
	 */
	private onPriorityChange(signal: TaskSignal) {
		const oldPriority = this.signals.get(signal);
		if (oldPriority === undefined) {
			throw new Error(
				"Attempting to change priority on an unregistered signal",
			);
		}
		if (oldPriority === signal.priority) return;

		// Change priority for both continuations and tasks.
		for (let i = 0; i < 2; i++) {
			const sourceQueue = this.queues[oldPriority][i];
			const destinationQueue = this.queues[signal.priority][i];

			destinationQueue.merge(sourceQueue, (task: SchedulerTask) => {
				return task.options.signal === signal;
			});
		}

		this.signals.set(signal, signal.priority);
	}

	/**
	 * Callback invoked when the host callback fires.
	 * @private
	 */
	schedulerEntryCallback() {
		this.pendingHostCallback = null;
		this.runNextTask();
		this.scheduleHostCallbackIfNeeded();
	}

	/**
	 * Schedule the next scheduler callback if there are any pending tasks.
	 */
	scheduleHostCallbackIfNeeded() {
		const { priority } = this.nextTaskPriority();
		if (priority == null) return;

		// We might need to upgrade to a non-idle callback if a higher priority task
		// is scheduled, in which case we cancel the pending host callback and
		// reschedule.
		if (
			priority !== "background" && this.pendingHostCallback &&
			this.pendingHostCallback.isIdleCallback()
		) {
			this.pendingHostCallback.cancel();
			this.pendingHostCallback = null;
		}

		// Either the priority of the new task is compatible with the pending host
		// callback, or it's a lower priority (we handled the other case above). In
		// either case, the pending callback is still valid.
		if (this.pendingHostCallback) return;

		this.pendingHostCallback = new HostCallback(
			() => {
				this.schedulerEntryCallback();
			},
			priority,
			0, /* delay */
		);
	}

	/**
	 * Compute the `task` priority and push it onto the appropriate task queue.
	 * If the priority comes from the associated signal, this will set up an event
	 * listener to listen for priority changes.
	 * @private
	 */
	pushTask(task: SchedulerTask) {
		// If an explicit priority was provided, we use that. Otherwise if a
		// TaskSignal was provided, we get the priority from that. If neither a
		// priority or TaskSignal was provided, we default to 'user-visible'.
		let priority: TaskPriority;
		if (task.options.priority) {
			priority = task.options.priority;
		} else if (task.options.signal && "priority" in task.options.signal) {
			priority = task.options.signal.priority;
		} else {
			priority = "user-visible";
		}

		// The priority should have already been validated before calling this
		// method, but check the assumption and fail loudly if it doesn't hold.
		if (!TaskPriorityTypes.includes(priority)) {
			throw new TypeError(`Invalid task priority: ${priority}`);
		}

		// Subscribe to priority change events if this is the first time we're
		// learning about this signal.
		if (task.options.signal && "priority" in task.options.signal) {
			const signal = task.options.signal;
			if (!this.signals.has(signal)) {
				signal.addEventListener("prioritychange", () => {
					this.onPriorityChange(signal);
				});
				this.signals.set(signal, signal.priority);
			}
		}
		this.queues[priority][task.isContinuation ? 0 : 1].push(task);
	}

	/**
	 * Run the oldest highest priority non-aborted task, if there is one.
	 * @private
	 */
	runNextTask() {
		let task: null | SchedulerTask = null;

		// Aborted tasks aren't removed from the task queue, so we need to keep
		// looping until we find a non-aborted task. Alternatively, we should
		// consider just removing them from their queue.
		do {
			// TODO(shaseley): This can potentially run a background task in a
			// non-background task host callback.
			const { priority, type } = this.nextTaskPriority();
			// No tasks to run.
			if (priority == null) return;

			// Note: `task` will only be null if the queue is empty, which should not
			// be the case if we found the priority of the next task to run.
			task = this.queues[priority][type].takeNextTask();
		} while (!task || task.isAborted());

		try {
			const result = task.callback();
			task.resolve(result);
		} catch (e) {
			task.reject(e);
		} finally {
			task.onTaskCompleted();
		}
	}

	/**
	 * Get the priority and type of the next task or continuation to run.
	 * @private
	 * @return Returns the priority and type
	 *    of the next continuation or task to run, or null if all queues are
	 *    empty.
	 */
	nextTaskPriority(): { priority: TaskPriority | null; type: number } {
		for (const priority of TaskPriorityTypes) {
			for (let type = 0; type < 2; type++) {
				if (this.queues[priority][type].headTask) return { priority, type };
			}
		}
		return { priority: null, type: 0 };
	}
}
