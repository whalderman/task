import { importPolyfillIfNecessary } from "./polyfill/polyfill.ts";
await importPolyfillIfNecessary();

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
 * let taskController = null;
 * document.querySelector("input").addEventListener(
 *   "input",
 *   (ev) => {
 *     const query = ev.target?.value;
 *     if (!query || query.length < 2) {
 *       return;
 *     }
 *
 *     // abort any active request
 *     taskController?.abort();
 *
 *     // Create a new TaskController
 *     taskController = new TaskController();
 *
 *     // Wrap a new fetch request
 *     const task = Task.wrapWithController(
 *       taskController,
 *       fetch(`https://somehost/api/search?q=${query}`, taskController)
 *         .then((response) => response.json())
 *         .then((data) => {
 *           // Use the data
 *           console.log(data);
 *         })
 *         .catch((e) => {
 *           // Check if the error is due to an abort
 *           if (e.name === "AbortError") {
 *             console.log("Fetch request was aborted.");
 *           } else {
 *             console.error("Fetch error:", e);
 *           }
 *         }),
 *     );
 *   },
 * );
 * ```
 *
 * The default priority for all Task objects can
 * be set with `Task.defaultControllerOptions`:
 *
 * @example
 * ```js
 * // lowest priority, the default for Task objects
 * Task.defaultControllerOptions = "background";
 * // middle priority, the default for the Scheduler API
 * Task.defaultControllerOptions = "user-visible";
 * // highest priority
 * Task.defaultControllerOptions = "user-blocking";
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
	static defaultControllerOptions: TaskControllerOptions = {
		priority: "background",
	};

	/**
	 * Executes a callback function and wraps its result or thrown error
	 * in a new Task with the provided TaskController. This is useful
	 * for starting a task chain from a synchronous function.
	 *
	 * @typeParam C:allback The type of the callback function.
	 * @param controller A TaskController instance. Used to dynamically control execution priority of subsequent callbacks.
	 * @param callback The function to execute.
	 * @param args The arguments to pass to the callback function.
	 * @returns A new Task that resolves with the callback's return value or rejects with its thrown error.
	 */
	static runWithController<Callback extends (...args: any[]) => any>(
		controller: TaskController,
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
		}, controller);
	}

	/**
	 * Executes a callback function and wraps its result or thrown error
	 * in a new Task and TaskController with the specified
	 * TaskControllerOptions. This is useful for starting a task chain
	 * from a synchronous function.
	 *
	 * @typeParam C:allback The type of the callback function.
	 * @param controllerOptions Options for a new TaskController instance. Used to dynamically control execution priority of subsequent callbacks.
	 * @param callback The function to execute.
	 * @param args The arguments to pass to the callback function.
	 * @returns A new Task that resolves with the callback's return value or rejects with its thrown error.
	 */
	static runWithOptions<Callback extends (...args: any[]) => any>(
		controllerOptions: TaskControllerOptions,
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
		}, new TaskController(controllerOptions));
	}

	/**
	 * Executes a callback function and wraps its result or thrown error
	 * in a new Task and TaskController with the specified default
	 * priority. This is useful for starting a task chain from a
	 * synchronous function.
	 *
	 * @typeParam C:allback The type of the callback function.
	 * @param callback The function to execute.
	 * @param priority The default priority to use in the returned Task's TaskController. Used to dynamically control execution priority of subsequent callbacks.
	 * @param args The arguments to pass to the callback function.
	 * @returns A new Task that resolves with the callback's return value or rejects with its thrown error.
	 */
	static runWithPriority<Callback extends (...args: any[]) => any>(
		priority: TaskPriority,
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
		}, new TaskController({ priority }));
	}

	/**
	 * Executes a callback function and wraps its result or thrown error
	 * in a new Task and TaskController with a default `"background"`
	 * priority. This is useful for starting a task chain from a
	 * synchronous function.
	 *
	 * @typeParam C:allback The type of the callback function.
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
	 * @param controller A TaskController instance. Used to dynamically control execution priority of subsequent callbacks.
	 * @param promise The promise to wrap.
	 * @returns A new Task that mirrors the state of the provided promise.
	 */
	static wrapWithController<P extends Promise<any>>(
		controller: TaskController,
		promise: P,
	): Task<Awaited<P>> {
		return new Task((resolve, reject) => {
			return promise.then(resolve, reject);
		}, controller);
	}

	/**
	 * Wraps an existing Promise in a Task instance.
	 * @typeParam P: The type of the Promise.
	 * @param controllerOptions Options for a new TaskController instance. Used to dynamically control execution priority of subsequent callbacks.
	 * @param promise The promise to wrap.
	 * @returns A new Task that mirrors the state of the provided promise.
	 */
	static wrapWithOptions<P extends Promise<any>>(
		controllerOptions: TaskControllerOptions,
		promise: P,
	): Task<Awaited<P>> {
		return new Task((resolve, reject) => {
			return promise.then(resolve, reject);
		}, new TaskController(controllerOptions));
	}

	/**
	 * Wraps an existing Promise in a Task instance.
	 * @typeParam P: The type of the Promise.
	 * @param priority The default priority to use in the returned Task's TaskController. Used to dynamically control execution priority of subsequent callbacks.
	 * @param promise The promise to wrap.
	 * @returns A new Task that mirrors the state of the provided promise.
	 */
	static wrapWithPriority<P extends Promise<any>>(
		priority: TaskPriority,
		promise: P,
	): Task<Awaited<P>> {
		return new Task((resolve, reject) => {
			return promise.then(resolve, reject);
		}, new TaskController({ priority }));
	}

	/**
	 * Wraps an existing Promise in a Task instance.
	 * @typeParam P: The type of the Promise.
	 * @param promise The promise to wrap.
	 * @returns A new Task that mirrors the state of the provided promise.
	 */
	static wrap<P extends Promise<any>>(promise: P): Task<Awaited<P>> {
		return new Task((resolve, reject) => {
			return promise.then(resolve, reject);
		});
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
		let resolve: (value: T | PromiseLike<T>) => void,
			reject: (reason?: any) => void;
		const task = new Task<T>((res, rej) => {
			resolve = res;
			reject = rej;
		});
		return {
			task,
			promise: task,
			// @ts-expect-error deno can't handle this
			resolve,
			// @ts-expect-error deno can't handle this
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
	 * @param reason The reason the promise was rejected.
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
	 * @param value A promise.
	 * @returns A Task whose internal state matches the provided Task or Promise.
	 */
	static override resolve<T>(value: T): Task<Awaited<T>>;
	/**
	 * Creates a new resolved Task for the provided value.
	 * @param value A promise.
	 * @returns A Task whose internal state matches the provided Task or Promise.
	 */
	static override resolve<T>(
		value?: void | Awaited<T> | PromiseLike<void | Awaited<T>>,
	): Task<Awaited<T | void>> {
		return Task.wrap(Promise.resolve(value));
	}

	controller: TaskController;

	/**
	 * A convenience property for getting this Task's priority.
	 */
	get priority(): TaskPriority {
		return this.controller.signal.priority;
	}
	/**
	 * A convenience property for setting the priority of this Task.
	 */
	set priority(priority: TaskPriority) {
		this.controller.setPriority(priority);
	}

	/**
	 * A convenience method for setting this Task's priority, mapped to
	 * `.controller.setPriority()`.
	 */
	setPriority(priority: TaskPriority) {
		this.controller.setPriority(priority);
	}

	constructor(
		executor: (
			resolve: (value: T | PromiseLike<T>) => void,
			reject: (reason?: any) => void,
		) => void,
		controller: TaskController = new TaskController(
			Task.defaultControllerOptions,
		),
	) {
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
						return scheduler.postTask(() => originalResolve(value), controller);
					},
				});
				const rejectProxy = new Proxy(reject, {
					apply(originalReject, _thisArg, [reason]: Parameters<typeof reject>) {
						return scheduler.postTask(() => originalReject(reason), controller);
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
							resolve(onfulfilled(value));
						} else {
							resolve(value);
						}
					},
					(reason) => {
						if (onrejected) {
							reject(onrejected(reason));
						} else {
							reject(reason);
						}
					},
				),
			// reuse the controller to maintain task priority settings
			this.controller,
		);
	}

	override catch<TResult = never>(
		onrejected?:
			| ((reason: any) => TResult | PromiseLike<TResult>)
			| undefined
			| null,
	): Task<T | TResult>;

	/**
	 * Attaches a callback for only the rejection of the Promise.
	 * @param onrejected The callback to execute when the Promise is rejected.
	 * @returns A Promise for the completion of the callback.
	 */
	override catch<TResult = never>(
		onrejected?:
			| ((reason: any) => TResult | PromiseLike<TResult>)
			| undefined
			| null,
	): Task<T | TResult> {
		return new Task(
			(_, reject) =>
				super.catch((reason) => {
					if (onrejected) {
						reject(onrejected(reason));
					} else {
						reject(reason);
					}
				}),
			// reuse the controller to maintain task priority settings
			this.controller,
		);
	}

	/**
	 * Attaches a callback that is invoked when the Promise is settled
	 * (fulfilled or rejected). The resolved value cannot be modified
	 * from the callback.
	 * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
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
	task: Task<T>;
	/**
	 * Same as `task`.
	 *
	 * Included for type compatibility with the static
	 * `Promise.withResolvers` method.
	 */
	promise: Task<T>;
	resolve: (value: T | PromiseLike<T>) => void;
	reject: (reason?: any) => void;
}
