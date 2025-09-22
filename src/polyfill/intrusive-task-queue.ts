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

import type { SchedulerTask } from "./scheduler.ts";

/**
 * This represents the overall task queuing order and is used for moving tasks
 * between task queues for priority changes.
 * @private
 * @type {number}
 */
let nextSequence: number = 0;

/**
 * An implementation of a task queue that augments the data being stored with
 * pointers to the previous and next entries. Storing the pointers on the data
 * reduces the number of objects created, cutting down on object churn.
 *
 * This task queue is implemented as a doubly-linked list, optimizing for
 * queueing and dequeing, as well as performant merges for priority change.
 *
 * This adds the following properties to tasks it owns:
 *  - tq_sequence_: The overall queueing order.
 *  - tq_prev_: A pointer to the previous task.
 *  - tq_next_: A pointer to the next task.
 */
class DoublyLinkedTaskQueue {
	headTask: null | SchedulerTask = null;
	private tailTask: null | SchedulerTask = null;

	/**
	 * Constructs an empty IntrusiveTaskQueue.
	 */
	constructor() {}

	push(task: SchedulerTask) {
		if (typeof task !== "object") throw new TypeError("Task must be an object");

		task.sequenceId = nextSequence++;

		if (!this.headTask) {
			task.prev = null;
			this.headTask = task;
		} else {
			task.prev = this.tailTask;
			if (this.tailTask) this.tailTask.next = task;
		}

		task.next = null;
		this.tailTask = task;
	}

	/** @return The oldest task or null of the queue is empty. */
	takeNextTask(): SchedulerTask | null {
		if (!this.headTask) return null;
		const task = this.headTask;
		this.remove(task);
		return task;
	}

	/**
	 * Merges all tasks from `sourceQueue` into this task queue for which
	 * `selector` returns true . Tasks are insterted into this queue based on
	 * their sequence number.
	 *
	 * @param sourceQueue
	 * @param selector
	 */
	merge(
		sourceQueue: DoublyLinkedTaskQueue,
		selector: (arg0: SchedulerTask) => boolean,
	) {
		if (typeof selector !== "function") {
			throw new TypeError("Must provide a selector function.");
		}
		if (sourceQueue == null) throw new Error("sourceQueue cannot be null");

		let currentTask = this.headTask;
		let previousTask = null;
		let iterator = sourceQueue.headTask;

		while (iterator) {
			// Advance the iterator now before we mutate it and ivalidate the
			// pointers.
			const taskToMove = iterator;
			iterator = iterator.next;

			if (selector(taskToMove)) {
				sourceQueue.remove(taskToMove);
				// Fast-forward until we're just past the insertion point. The new task
				// is inserted between previousTask and currentTask.
				while (
					currentTask &&
					(currentTask.sequenceId < taskToMove.sequenceId)
				) {
					previousTask = currentTask;
					currentTask = currentTask.next;
				}
				this.insert(taskToMove, previousTask);
				previousTask = taskToMove;
			}
		}
	}

	/**
	 * Insert `task` into this queue directly after `parentTask`.
	 * @param task The task to insert.
	 * @param parentTask The task preceding `task` in this queue, or
	 *    null if `task` should be inserted at the beginning.
	 */
	private insert(task: SchedulerTask, parentTask: SchedulerTask | null) {
		// We can simply push the new task if it belongs at the end.
		if (parentTask == this.tailTask) {
			this.push(task);
			return;
		}

		// `nextTask` is the next task in the list, which should not be null since
		// `parentTask` is not the tail (which is the only task with a null next
		// pointer).
		const nextTask = parentTask ? parentTask.next : this.headTask;

		task.next = nextTask;
		nextTask!.prev = task;

		task.prev = parentTask;

		if (parentTask != null) {
			parentTask.next = task;
		} else {
			this.headTask = task;
		}
	}

	private remove(task: SchedulerTask) {
		if (task === this.headTask) this.headTask = task.next;
		if (task === this.tailTask) this.tailTask = this.tailTask.prev;
		if (task.next) task.next.prev = task.prev;
		if (task.prev) task.prev.next = task.next;
	}
}

export { DoublyLinkedTaskQueue as IntrusiveTaskQueue };
