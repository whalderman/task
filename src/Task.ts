import type * as polyfill from "./polyfill/types.d.ts";

// deno-lint-ignore no-var
declare var scheduler: polyfill.Scheduler;
// deno-lint-ignore no-var
declare var TaskController: typeof polyfill.TaskController;

const validPrioritySet: Set<polyfill.TaskPriority> = new Set([
	"background",
	"user-blocking",
	"user-visible",
]);

interface PostTaskInit
	extends Omit<polyfill.SchedulerPostTaskOptions, "signal"> {
}
class PostTaskController extends TaskController implements PostTaskInit {
	#delay?: number;
	/**
	 * Returns a single-use delay value (in milliseconds) for the next
	 * task scheduled with this controller. After being accessed, the
	 * delay is cleared (set to `undefined`).
	 */
	get delay(): number | undefined {
		const value = this.#delay;
		this.#delay = undefined;
		return value;
	}

	/**
	 * Sets a single-use delay value (in milliseconds) for the next
	 * task scheduled with this controller.
	 * @param delay A delay in milliseconds.
	 */
	setNextDelay(delay: number | undefined) {
		this.#delay = delay;
	}

	constructor(init?: PostTaskInit) {
		super(init);
		this.#delay = init?.delay;
	}
}

/**
 * @typeParam T: The type of the value that the Task will resolve to.
 *
 * A Task is a Promise. It includes additional utility
 * methods and a TaskController for more fine-grained control over its
 * execution. This class relies on your JavaScript runtime having
 * implemented the [Prioritized Task Scheduling API](
 * https://developer.mozilla.org/docs/Web/API/Prioritized_Task_Scheduling_API).
 *
 * A Task will **always** be slower than the equivalent Promise.
 * Tasks are meant to improve time to user interactivity, *not*
 * execution time. Tasks will default to the lowest priority available
 * in the Scheduler API.
 *
 * @example
 * ```js
 * // import modules in the background
 * const cm = {
 * 	autocomplete: Task.wrap(import("@codemirror/autocomplete")),
 * 	commands: Task.wrap(import("@codemirror/commands")),
 * 	lang_json: Task.wrap(import("@codemirror/lang-json")),
 * 	language: Task.wrap(import("@codemirror/language")),
 * 	lint: Task.wrap(import("@codemirror/lint")),
 * 	search: Task.wrap(import("@codemirror/search")),
 * 	state: Task.wrap(import("@codemirror/state")),
 * 	view: Task.wrap(import("@codemirror/view")),
 * };
 *
 * // Run some analyses sequentially
 * const analyses = [];
 * Task.run(async function awaitAnalyses() {
 * 	for await (const analysis of generator) {
 * 		analyses.push(analysis);
 * 		// yield back to the main thread after each analysis.
 * 		await scheduler.yield();
 * 	}
 * });
 *
 * // etc.
 * ```
 *
 * The default priority for all Task objects can
 * be set with `Task.defaultPriority`:
 *
 * @example
 * ```js
 * // low priority (default)
 * Task.defaultPriority = "background";
 * // base priority
 * Task.defaultPriority = "user-visible";
 * // high priority
 * Task.defaultPriority = "user-blocking";
 * ```
 *
 * The priority of a Task and its subsequent chained Tasks (`then`,
 * `catch`) can also be updated at any point using the `controller`
 * property of an active Task.
 *
 * @example
 * ```js
 * const task = Task.wrap(import("some-module.js"));
 *
 * console.log(task.controller.signal.priority); // "background"
 * // console.log(task.priority); // "background"
 *
 * task.controller.setPriority("user-blocking");
 * // task.setPriority("user-blocking");
 *
 * console.log(task.controller.signal.priority); // "user-blocking"
 * // console.log(task.priority); // "user-blocking"
 * ```
 */
export class Task<T> extends Promise<T> {
	static #defaultInit = {
		priority: "background" as polyfill.TaskPriority,
	} satisfies PostTaskInit;
	static get defaultPriority(): polyfill.TaskPriority {
		return this.#defaultInit.priority;
	}
	static set defaultPriority(priority: polyfill.TaskPriority) {
		if (!validPrioritySet.has(priority)) {
			console.error(
				`Invalid Task priority (${priority}). Must be one of: "background", "user-visible", or "user-blocking".`,
			);
			return;
		}
		this.#defaultInit.priority = priority;
	}

	/**
	 * A convenience method for `scheduler.yield()`.
	 *
	 * The yield() method of the Scheduler interface is used for yielding to the main thread during a task and continuing execution later, with the continuation scheduled as a prioritized task (see the Prioritized Task Scheduling API for more information). This allows long-running work to be broken up so the browser stays responsive.
	 */
	static yield = () => scheduler.yield();

	/**
	 * Executes a callback function and wraps its result or thrown error
	 * in a new Task and TaskController with the specified
	 * TaskControllerInit. This is useful for starting a task chain from a synchronous function.
	 *
	 * @typeParam Callback The type of the callback function.
	 * @param options Options for a new TaskController instance. Used to dynamically control execution priority of subsequent callbacks.
	 * @param callback The function to execute.
	 * @param args The arguments to pass to the callback function.
	 * @returns A new Task that resolves with the callback's return value or rejects with its thrown error.
	 */
	static runWithOptions<Callback extends (...args: any[]) => any>(
		options: PostTaskInit,
		callback: Callback,
		...args: Parameters<Callback>
	): Task<Awaited<ReturnType<Callback>>> {
		return new Task<Awaited<ReturnType<Callback>>>(
			(resolve, reject) => {
				try {
					const value = callback(...args);
					resolve(value);
				} catch (e) {
					reject(e);
				}
			},
			options,
		);
	}

	/**
	 * Executes a callback function and wraps its result or thrown error
	 * in a new Task and TaskController with a default `"background"`
	 * priority. This is useful for starting a task chain from a
	 * synchronous function.
	 *
	 * @typeParam Callback The type of the callback function.
	 * @param callback The function to execute.
	 * @param args The arguments to pass to the callback function.
	 * @returns A new Task that resolves with the callback's return value or rejects with its thrown error.
	 */
	static run<Callback extends (...args: any[]) => any>(
		callback: Callback,
		...args: Parameters<Callback>
	): Task<Awaited<ReturnType<Callback>>> {
		return new Task<Awaited<ReturnType<Callback>>>((resolve, reject) => {
			try {
				const value = callback(...args);
				resolve(value);
			} catch (e) {
				reject(e);
			}
		});
	}

	/**
	 * Wraps an existing Promise in a Task instance.
	 * @typeParam P: The type of the Promise.
	 * @param options Options for a new TaskController instance. Used to dynamically control execution priority of subsequent callbacks.
	 * @param promise The promise to wrap.
	 * @returns A new Task that mirrors the state of the provided promise.
	 */
	static wrapWithOptions<P extends Promise<any>>(
		options: PostTaskInit,
		promise: P,
	): Task<Awaited<P>> {
		return new Task((resolve, reject) => {
			return promise.then(resolve, reject);
		}, options);
	}

	/**
	 * Wraps an existing Promise in a Task instance.
	 * @typeParam P: The type of the Promise.
	 * @param promise The promise to wrap.
	 * @returns A new Task that mirrors the state of the provided promise.
	 */
	static wrap<P extends Promise<any>>(promise: P): Task<Awaited<P>> {
		return new Task((resolve, reject) => promise.then(resolve, reject));
	}

	/**
	 * Creates a Task that is resolved with an array of results when all
	 * of the provided Promises resolve, or rejected when any Promise is
	 * rejected.
	 * @param values An array of Promises.
	 * @returns A new Task.
	 */
	static override all<T extends readonly unknown[] | []>(
		values: T,
	): Task<{ -readonly [P in keyof T]: Awaited<T[P]> }> {
		return Task.wrap(Promise.all(values));
	}

	/**
	 * Creates a Task that is resolved with an array of results when all
	 * of the provided Promises resolve or reject.
	 * @param values An array of Promises.
	 * @returns A new Task.
	 */
	static override allSettled<T extends readonly unknown[] | []>(
		values: T,
	): Task<{ -readonly [P in keyof T]: PromiseSettledResult<Awaited<T[P]>> }>;

	/**
	 * Creates a Task that is resolved with an array of results when all
	 * of the provided Promises resolve or reject.
	 * @param values An array of Promises.
	 * @returns A new Task.
	 */
	static override allSettled<T>(
		values: Iterable<T | PromiseLike<T>>,
	): Task<PromiseSettledResult<Awaited<T>>[]> {
		return Task.wrap(Promise.allSettled(values));
	}

	/**
	 * The any function returns a Task that is fulfilled by the first
	 * given promise to be fulfilled, or rejected with an AggregateError
	 * containing an array of rejection reasons if all of the given
	 * promises are rejected. It resolves all elements of the passed
	 * iterable to promises as it runs this algorithm.
	 * @param values An array or iterable of Promises.
	 * @returns A new Promise.
	 */
	static override any<T extends readonly unknown[] | []>(
		values: T,
	): Task<Awaited<T[number]>>;

	/**
	 * The any function returns a Task that is fulfilled by the first
	 * given promise to be fulfilled, or rejected with an AggregateError
	 * containing an array of rejection reasons if all of the given
	 * promises are rejected. It resolves all elements of the passed
	 * iterable to promises as it runs this algorithm.
	 * @param values An array or iterable of Promises.
	 * @returns A new Promise.
	 */
	static override any<T>(
		values: Iterable<T | PromiseLike<T>>,
	): Task<Awaited<T>> {
		return Task.wrap(Promise.any(values));
	}

	/**
	 * Creates a new Task and returns it in an object, along with its
	 * resolve and reject functions.
	 * @returns An object with the properties promise, `resolve`, and `reject`.
	 *
	 * ```ts
	 * const { promise, resolve, reject } = Task.withResolvers<T>();
	 * ```
	 */
	static override withResolvers<T>(): TaskWithResolvers<T> {
		let resolve!: (value: T | PromiseLike<T>) => void;
		let reject!: (reason?: any) => void;
		const task = new Task<T>((res, rej) => {
			resolve = res;
			reject = rej;
		});
		return {
			promise: task,
			resolve,
			reject,
		};
	}

	/**
	 * Takes a callback of any kind (returns or throws, synchronously or
	 * asynchronously) and wraps its result in a Task.
	 *
	 * @param callbackFn A function that is called synchronously. It can do anything: either return a value, throw an error, or return a Task.
	 * @param args Additional arguments, that will be passed to the callback.
	 *
	 * @returns A Task that is:
	 * - Already fulfilled, if the callback synchronously returns a value.
	 * - Already rejected, if the callback synchronously throws an error.
	 * - Asynchronously fulfilled or rejected, if the callback returns a Task.
	 */
	static override try<T, U extends unknown[]>(
		callbackFn: (...args: U) => T | PromiseLike<T>,
		...args: U
	): Task<Awaited<T>> {
		return Task.wrap(Promise.try(callbackFn, ...args));
	}

	/**
	 * Creates a Task that is resolved or rejected when any of the
	 * provided Promises are resolved or rejected.
	 * @param values An array of Promises.
	 * @returns A new Task.
	 */
	static override race<T extends readonly unknown[] | []>(
		values: T,
	): Task<Awaited<T[number]>> {
		return Task.wrap(Promise.race(values));
	}

	/**
	 * Creates a new rejected Task for the provided reason.
	 * @param reason The reason the task was rejected.
	 * @returns A new rejected Task.
	 */
	static override reject<T = never>(reason?: any): Task<T> {
		return Task.wrap(Promise.reject(reason));
	}

	/**
	 * Creates a new resolved Task.
	 * @returns A resolved Task.
	 */
	static override resolve(): Task<void>;
	/**
	 * Creates a new resolved Task for the provided value.
	 * @param value A task or promise.
	 * @returns A Task whose internal state matches the provided Task or Promise.
	 */
	static override resolve<T>(value: T): Task<Awaited<T>>;
	/**
	 * Creates a new resolved Task for the provided value.
	 * @param value A task or promise.
	 * @returns A Task whose internal state matches the provided Task or Promise.
	 */
	static override resolve<T>(
		value?: void | Awaited<T> | PromiseLike<void | Awaited<T>>,
	): Task<Awaited<T | void>> {
		return Task.wrap(Promise.resolve(value));
	}

	readonly controller: PostTaskController;

	/**
	 * A convenience property for getting this Task's priority.
	 */
	get priority(): polyfill.TaskPriority {
		return this.controller.signal.priority;
	}

	/**
	 * A convenience method for setting this Task's priority, mapped to
	 * `.controller.setPriority()`.
	 */
	setPriority(priority: polyfill.TaskPriority) {
		this.controller.setPriority(priority);
	}

	constructor(
		executor: (
			resolve: (value: T | PromiseLike<T>) => void,
			reject: (reason?: any) => void,
		) => void,
		options: PostTaskInit | PostTaskController = new PostTaskController({
			priority: Task.defaultPriority,
		}),
	) {
		const controller = options instanceof PostTaskController
			? options
			: Object.assign(
				new PostTaskController({
					priority: options.priority ?? Task.defaultPriority,
				}),
				options,
			);
		const executorProxy = new Proxy(executor, {
			apply(
				originalExecutor,
				_thisArg,
				[resolve, reject]: Parameters<typeof executor>,
			) {
				const resolveProxy = new Proxy(resolve, {
					apply(
						originalResolve,
						_thisArg,
						[value]: Parameters<typeof resolve>,
					) {
						return scheduler.postTask(
							() => originalResolve(value),
							controller,
						);
					},
				});
				const rejectProxy = new Proxy(reject, {
					apply(originalReject, _thisArg, [reason]: Parameters<typeof reject>) {
						return scheduler.postTask(
							() => originalReject(reason),
							controller,
						);
					},
				});
				return originalExecutor(resolveProxy, rejectProxy);
			},
		});
		super(executorProxy);
		this.controller = controller;
	}

	/**
	 * Attaches callbacks for the resolution and/or rejection of the Task.
	 * @param onfulfilled The callback to execute when the Task is resolved.
	 * @param onrejected The callback to execute when the Task is rejected.
	 * @returns A Task for the completion of which ever callback is executed.
	 */
	override then<TResult1 = T, TResult2 = never>(
		onfulfilled?:
			| ((value: T) => TResult1 | PromiseLike<TResult1>)
			| undefined
			| null,
		onrejected?:
			| ((reason: any) => TResult2 | PromiseLike<TResult2>)
			| undefined
			| null,
	): Task<TResult1 | TResult2> {
		return new Task<TResult1 | TResult2>(
			(resolve, reject) =>
				super.then(
					(value: any) => {
						if (onfulfilled) {
							try {
								const result = onfulfilled(value);
								resolve(result);
							} catch (e) {
								reject(e);
							}
						} else {
							resolve(value);
						}
					},
					(reason) => {
						if (onrejected) {
							try {
								const result = onrejected(reason);
								resolve(result);
							} catch (e) {
								reject(e);
							}
						} else {
							reject(reason);
						}
					},
				),
			// reuse the controller to maintain task priority settings
			this.controller,
		);
	}

	/**
	 * Attaches a callback for only the rejection of the Task.
	 * @param onrejected The callback to execute when the Task is rejected.
	 * @returns A Task for the completion of the callback.
	 */
	override catch<TResult = never>(
		onrejected?:
			| ((reason: any) => TResult | PromiseLike<TResult>)
			| undefined
			| null,
	): Task<T | TResult> {
		return new Task(
			(resolve, reject) => super.catch(onrejected).then(resolve, reject),
			// reuse the controller to maintain task priority settings
			this.controller,
		);
	}

	/**
	 * Attaches a callback that is invoked when the Task is settled
	 * (fulfilled or rejected). The resolved value cannot be modified
	 * from the callback.
	 * @param onfinally The callback to execute when the Task is settled (fulfilled or rejected).
	 * @returns A Task for the completion of the callback.
	 */
	override finally(onfinally?: (() => void) | undefined | null): Task<T> {
		return new Task(
			(resolve, reject) => super.finally(onfinally).then(resolve, reject),
			// reuse the controller to maintain task priority settings
			this.controller,
		);
	}
}

export default Task;

export interface TaskWithResolvers<T> extends PromiseWithResolvers<T> {
	/** The `Task`. */
	promise: Task<T>;
	resolve: (value: T | PromiseLike<T>) => void;
	reject: (reason?: any) => void;
}
