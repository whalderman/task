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

import { SchedulerTask } from "./Scheduler.ts";

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
	precedingTask: null | SchedulerTask = null;
	private followingTask: null | SchedulerTask = null;

	/**
	 * Constructs an empty IntrusiveTaskQueue.
	 */
	constructor() {}

	push(newTask: SchedulerTask) {
		if (!(newTask instanceof SchedulerTask)) {
			throw new TypeError("task must be an instance of SchedulerTask");
		}

		newTask.sequenceId = nextSequence++;

		if (!this.precedingTask) {
			newTask.preceding = null;
			this.precedingTask = newTask;
		} else {
			newTask.preceding = this.followingTask;
			if (this.followingTask) this.followingTask.next = newTask;
		}

		newTask.next = null;
		this.followingTask = newTask;
	}

	/** @return The oldest task or null of the queue is empty. */
	takeNextTask(): SchedulerTask | null {
		if (!this.precedingTask) return null;
		const task = this.precedingTask;
		this.remove(task);
		return task;
	}

	/**
	 * Merges all tasks from `sourceQueue` into this task queue for which
	 * `selector` returns true. Tasks are inserted into this queue based on
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

		let currentTask = this.precedingTask;
		let previousTask = null;
		let iterator = sourceQueue.precedingTask;

		while (iterator) {
			// Advance the iterator now before we mutate it and invalidate the
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
	 * @param parentTask The task preceding `task` in this queue, or null if `task` should be inserted at the beginning.
	 */
	private insert(task: SchedulerTask, parentTask: SchedulerTask | null) {
		// We can simply push the new task if it belongs at the end.
		if (parentTask == this.followingTask) {
			this.push(task);
			return;
		}

		// `nextTask` is the next task in the list, which should not be null since
		// `parentTask` is not the tail (which is the only task with a null next
		// pointer).
		const nextTask = parentTask ? parentTask.next : this.precedingTask;

		task.next = nextTask;
		nextTask!.preceding = task;

		task.preceding = parentTask;

		if (parentTask != null) {
			parentTask.next = task;
		} else {
			this.precedingTask = task;
		}
	}

	private remove(task: SchedulerTask) {
		// If removing the head task, update the head pointer to the next task.
		if (task === this.precedingTask) this.precedingTask = task.next;
		// If removing the tail task, update the tail pointer to the previous task.
		if (task === this.followingTask) {
			this.followingTask = this.followingTask.preceding;
		}
		// If there is a next task, update its previous pointer.
		if (task.next) task.next.preceding = task.preceding;
		// If there is a preceding task, update its next pointer.
		if (task.preceding) task.preceding.next = task.next;
	}
}

export { DoublyLinkedTaskQueue };
