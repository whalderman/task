// types from @types/web

export type TaskPriority = "background" | "user-blocking" | "user-visible";

export interface TaskControllerInit {
	priority?: TaskPriority;
}

export interface TaskSignalAnyInit {
	priority?: TaskPriority | TaskSignal;
}

/**
 * The **`TaskPriorityChangeEvent`** is the interface for the prioritychange event.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/TaskPriorityChangeEvent)
 */
export interface TaskPriorityChangeEvent extends Event {
	/**
	 * The **`previousPriority`** read-only property of the TaskPriorityChangeEvent interface returns the priority of the corresponding TaskSignal before it was changed and this prioritychange event was emitted.
	 *
	 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/TaskPriorityChangeEvent/previousPriority)
	 */
	readonly previousPriority: TaskPriority;
}

export interface TaskPriorityChangeEventInit extends EventInit {
	previousPriority: TaskPriority;
}

// deno-lint-ignore no-var
declare var TaskPriorityChangeEvent: {
	prototype: TaskPriorityChangeEvent;
	new (
		type: string,
		priorityChangeEventInitDict: TaskPriorityChangeEventInit,
	): TaskPriorityChangeEvent;
};

export interface TaskSignalEventMap extends AbortSignalEventMap {
	"prioritychange": TaskPriorityChangeEvent;
}

/**
 * The **`TaskSignal`** interface of the Prioritized Task Scheduling API represents a signal object that allows you to communicate with a prioritized task, and abort it or change the priority (if required) via a TaskController object.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/TaskSignal)
 */
export interface TaskSignal extends AbortSignal {
	/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/TaskSignal/prioritychange_event) */
	onprioritychange:
		| ((this: TaskSignal, ev: TaskPriorityChangeEvent) => any)
		| null;
	/**
	 * The read-only **`priority`** property of the TaskSignal interface indicates the signal priority.
	 *
	 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/TaskSignal/priority)
	 */
	readonly priority: TaskPriority;
	addEventListener<K extends keyof TaskSignalEventMap>(
		type: K,
		listener: (this: TaskSignal, ev: TaskSignalEventMap[K]) => any,
		options?: boolean | AddEventListenerOptions,
	): void;
	addEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject,
		options?: boolean | AddEventListenerOptions,
	): void;
	removeEventListener<K extends keyof TaskSignalEventMap>(
		type: K,
		listener: (this: TaskSignal, ev: TaskSignalEventMap[K]) => any,
		options?: boolean | EventListenerOptions,
	): void;
	removeEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject,
		options?: boolean | EventListenerOptions,
	): void;
}

// deno-lint-ignore no-var
export declare var TaskSignal: {
	prototype: TaskSignal;
	new (): TaskSignal;
	/**
	 * The **`TaskSignal.any()`** static method takes an iterable of AbortSignal objects and returns a TaskSignal. The returned task signal is aborted when any of the abort signals is aborted.
	 *
	 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/TaskSignal/any_static)
	 */
	any(signals: AbortSignal[], init?: TaskSignalAnyInit): TaskSignal;
};

/**
 * The **`TaskController`** interface of the Prioritized Task Scheduling API represents a controller object that can be used to both abort and change the priority of one or more prioritized tasks. If there is no need to change task priorities, then AbortController can be used instead.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/TaskController)
 */
export interface TaskController extends AbortController {
	/**
	 * The **`setPriority()`** method of the TaskController interface can be called to set a new priority for this controller's signal. If a prioritized task is configured to use the signal, this will also change the task priority.
	 *
	 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/TaskController/setPriority)
	 */
	setPriority(priority: TaskPriority): void;
	signal: TaskSignal;
}

// deno-lint-ignore no-var
export declare var TaskController: {
	prototype: TaskController;
	new (init?: TaskControllerInit): TaskController;
};

export interface SchedulerPostTaskOptions {
	/**
	 * The minimum amount of time after which the task will be added to the scheduler queue, in whole milliseconds. The actual delay may be higher than specified, but will not be less. The default delay is 0.
	 */
	delay?: number;
	/**
	 * The immutable priority of the task. One of: "user-blocking", "user-visible", "background". If set, this priority is used for the lifetime of the task and priority set on the signal is ignored.
	 */
	priority?: TaskPriority;
	/**
	 * A TaskSignal or AbortSignal that can be used to abort the task (from its associated controller).
	 *
	 * If the options.priority parameter is set then the task priority cannot be changed, and any priority on the signal is ignored. Otherwise, if the signal is a TaskSignal its priority is used to set the initial task priority, and the signal's controller may later use it to change the task priority.
	 */
	signal?: TaskSignal | AbortSignal;
}

export type SchedulerPostTaskCallback = () => any;

/**
 * The **`Scheduler`** interface of the Prioritized Task Scheduling API provides methods for scheduling prioritized tasks.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Scheduler)
 */
export interface Scheduler {
	/**
	 * The **`postTask()`** method of the Scheduler interface is used for adding tasks to be scheduled according to their priority.
	 *
	 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Scheduler/postTask)
	 *
	 * @param callback A callback function that implements the task. The return value of the callback is used to resolve the promise returned by this function.
	 * @param options Task options.
	 */
	postTask<Callback extends SchedulerPostTaskCallback>(
		callback: Callback,
		options?: SchedulerPostTaskOptions,
	): Promise<Awaited<ReturnType<typeof callback>>>;
	/**
	 * The **`yield()`** method of the Scheduler interface is used for yielding to the main thread during a task and continuing execution later, with the continuation scheduled as a prioritized task (see the Prioritized Task Scheduling API for more information). This allows long-running work to be broken up so the browser stays responsive.
	 *
	 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Scheduler/yield)
	 */
	yield(): Promise<void>;
}

// deno-lint-ignore no-var
declare var Scheduler: {
	prototype: Scheduler;
	new (): Scheduler;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/scheduler) */
// deno-lint-ignore no-var
declare var scheduler: Scheduler;
