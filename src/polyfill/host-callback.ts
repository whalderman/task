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
 * This class manages scheduling and running callbacks using postMessage.
 * @private
 */
class PostMessageCallbackManager {
	private channel: MessageChannel;
	private sendPort: MessagePort;
	private messages: Record<number, () => void>;
	private nextMessageId: number;

	/**
	 * Construct a PostMessageCallbackMananger, which handles scheduling
	 * and running callbacks via a MessageChannel.
	 */
	constructor() {
		this.channel = new MessageChannel();
		this.sendPort = this.channel.port2;
		this.messages = {};
		this.nextMessageId = 1;
		this.channel.port1.onmessage = (e) => this.onMessageReceived(e);
	}

	/**
	 * @param callback
	 * @return {number} A handle that can used for cancellation.
	 */
	queueCallback(callback: () => void): number {
		// We support multiple pending postMessage callbacks by associating a handle
		// with each message, which is used to look up the callback when the message
		// is received.
		const seqId = this.nextMessageId++;
		this.messages[seqId] = callback;
		this.sendPort.postMessage(seqId);
		return seqId;
	}

	/**
	 * @param {number} seqId The seqId returned when the callback was queued.
	 */
	cancelCallback(seqId: number) {
		delete this.messages[seqId];
	}

	/**
	 * The onmessage handler, invoked when the postMessage runs.
	 * @param ev
	 */
	private onMessageReceived(ev: MessageEvent) {
		const seqId = ev.data;
		const callback = this.messages[seqId];
		// The handle will have been removed if the callback was canceled.
		if (!callback) return;
		delete this.messages[seqId];
		callback();
	}
}

let postMessageCallbackManager: PostMessageCallbackManager | undefined;
try {
	postMessageCallbackManager = new PostMessageCallbackManager();
} catch (e) {
	// MessageChannel is likely undefined.
	console.error(e);
}

const enum CallbackType {
	REQUEST_IDLE_CALLBACK,
	SET_TIMEOUT,
	POST_MESSAGE,
}

/**
 * HostCallback is used for tracking host callbacks, both for the schedueler
 * entrypoint --- which can be a postMessage, setTimeout, or
 * requestIdleCallback --- and for delayed tasks.
 */
class HostCallback {
	callback: () => void;
	callbackType: CallbackType = CallbackType.POST_MESSAGE;
	handle: null | number = null;
	canceled = false;
	/**
	 * @param callback
	 * @param priority The scheduler priority of the associated host
	 *     callback. This is used to determine which type of underlying API to
	 *     use. This can be null if delay is set.
	 * @param delay An optional delay. Tasks with a delay will
	 *     ignore the `priority` parameter and use setTimeout.
	 */
	constructor(
		callback: () => void,
		priority: TaskPriority | null,
		delay: number = 0,
	) {
		/** @type {function(): undefined} */
		this.callback = callback;
		this.schedule(priority, delay);
	}

	/**
	 * Returns true iff this task was scheduled with requestIdleCallback.
	 * @return {boolean}
	 */
	isIdleCallback(): boolean {
		return this.callbackType === CallbackType.REQUEST_IDLE_CALLBACK;
	}

	/**
	 * Returns true iff this task was scheduled with MessageChannel.
	 * @return {boolean}
	 */
	isMessageChannelCallback(): boolean {
		return this.callbackType === CallbackType.POST_MESSAGE;
	}

	/**
	 * Cancel the host callback, and if possible, cancel the underlying API call.
	 */
	cancel() {
		if (this.canceled) return;
		this.canceled = true;

		switch (this.callbackType) {
			case CallbackType.REQUEST_IDLE_CALLBACK:
				this.handle && self.cancelIdleCallback(this.handle);
				break;
			case CallbackType.SET_TIMEOUT:
				this.handle && clearTimeout(this.handle);
				break;
			case CallbackType.POST_MESSAGE:
				this.handle &&
					postMessageCallbackManager!.cancelCallback(this.handle);
				break;
			default:
				throw new TypeError("Unknown CallbackType");
		}
	}

	/**
	 * @private
	 * @param priority The scheduler priority of the associated host
	 *     callback. This is used to determine which type of underlying API to
	 *     use. This can be null if delay is set.
	 * @param delay An optional delay. Tasks with a delay will
	 *     ignore the `priority` parameter and use setTimeout.
	 */
	schedule(priority: TaskPriority | null, delay: number) {
		// For the delay case, our only option is setTimeout. This gets queued at
		// the appropriate priority when the callback runs. If the delay <= 0 and
		// MessageChannel is available, we use postMessage below.
		if (delay && delay > 0) {
			this.callbackType = CallbackType.SET_TIMEOUT;
			this.handle = self.setTimeout(() => {
				this.runCallback();
			}, delay);
			return;
		}

		// This shouldn't happen since Scheduler checks the priority before creating
		// a HostCallback, but fail loudly in case it does.
		if (!TaskPriorityTypes.includes(priority as TaskPriority)) {
			throw new TypeError(`Invalid task priority : ${priority}`);
		}

		if (
			priority === "background" &&
			typeof requestIdleCallback === "function"
		) {
			this.callbackType = CallbackType.REQUEST_IDLE_CALLBACK;
			this.handle = requestIdleCallback(() => {
				this.runCallback();
			});
			return;
		}

		// Use MessageChannel if avaliable.
		if (typeof MessageChannel === "function") {
			this.callbackType = CallbackType.POST_MESSAGE;
			// TODO: Consider using setTimeout in the background so tasks are
			// throttled. One caveat here is that requestIdleCallback may not be
			// throttled.
			this.handle = postMessageCallbackManager!.queueCallback(() => {
				this.runCallback();
			});
			return;
		}

		// Some JS environments may not support MessageChannel.
		// This makes setTimeout the only option.
		this.callbackType = CallbackType.SET_TIMEOUT;
		this.handle = self.setTimeout(() => {
			this.runCallback();
		});
	}

	/** Run the associated callback. */
	runCallback() {
		if (this.canceled) return;
		this.callback();
	}
}

export { HostCallback };
