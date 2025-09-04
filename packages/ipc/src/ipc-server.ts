import EventEmitter from "node:events"
import { Socket } from "node:net"
import * as crypto from "node:crypto"

import ipc from "node-ipc"

import {
	type IpcServerEvents,
	type RooCodeIpcServer,
	IpcOrigin,
	IpcMessageType,
	type IpcMessage,
	ipcMessageSchema,
} from "@roo-code/types"

export class IpcServer extends EventEmitter<IpcServerEvents> implements RooCodeIpcServer {
	private readonly _socketPath: string
	private readonly _log: (...args: unknown[]) => void
	private readonly _clients: Map<string, Socket>

	private _isListening = false

	constructor(socketPath: string, log = console.log) {
		super()

		this._socketPath = socketPath
		this._log = log
		this._clients = new Map()
	}

	public listen() {
		this._isListening = true

		ipc.config.silent = true

		ipc.serve(this.socketPath, () => {
			ipc.server.on("connect", (socket) => this.onConnect(socket))
			ipc.server.on("socket.disconnected", (socket) => this.onDisconnect(socket))
			ipc.server.on("message", (data, socket) => this.onMessage(data, socket))
		})

		ipc.server.start()
	}

	private onConnect(socket: Socket) {
		this.log(`[server#onConnect] New socket connected. Waiting for identification. Total clients: ${this._clients.size}`)
	}

	private onDisconnect(destroyedSocket: Socket) {
		let disconnectedClientId: string | undefined

		for (const [clientId, socket] of this._clients.entries()) {
			if (socket === destroyedSocket) {
				disconnectedClientId = clientId
				this._clients.delete(clientId)
				break
			}
		}

		this.log(`[server#socket.disconnected] clientId = ${disconnectedClientId}, # clients = ${this._clients.size}`)

		if (disconnectedClientId) {
			this.emit(IpcMessageType.Disconnect, disconnectedClientId)
		}
	}

	private onMessage(data: unknown, socket: Socket) {
		this.log(`[server#onMessage] Received data:`, data)
		if (typeof data !== "object") {
			this.log("[server#onMessage] invalid data type", typeof data)
			return
		}

		const result = ipcMessageSchema.safeParse(data)

		if (!result.success) {
			this.log("[server#onMessage] invalid payload", result.error.format(), data)
			return
		}

		const payload = result.data
		this.log(`[server#onMessage] Parsed payload:`, payload)


		if (payload.origin === IpcOrigin.Client) {
			const clientId = payload.clientId
			if (!this._clients.has(clientId)) {
				this._clients.set(clientId, socket)
				this.log(`[server#onMessage] Registered new client: ${clientId}. Total clients: ${this._clients.size}`)

				this.send(socket, {
					type: IpcMessageType.Ack,
					origin: IpcOrigin.Server,
					data: { clientId, pid: process.pid, ppid: process.ppid },
				})
				this.emit(IpcMessageType.Connect, clientId)
			}

			switch (payload.type) {
				case IpcMessageType.TaskCommand:
					this.log(`[server#onMessage] Emitting TaskCommand for client: ${clientId}`)
					this.emit(IpcMessageType.TaskCommand, clientId, payload.data)
					break
				default:
					this.log(`[server#onMessage] unhandled payload:`, payload)
					break
			}
		}
	}

	private log(...args: unknown[]) {
		this._log(...args)
	}

	public broadcast(message: IpcMessage) {
		// this.log("[server#broadcast] message =", message)
		ipc.server.broadcast("message", message)
	}

	public send(client: string | Socket, message: IpcMessage) {
		this.log("[server#send] message =", message)

		if (typeof client === "string") {
			const socket = this._clients.get(client)

			if (socket) {
				ipc.server.emit(socket, "message", message)
			}
		} else {
			ipc.server.emit(client, "message", message)
		}
	}

	public get socketPath() {
		return this._socketPath
	}

	public get isListening() {
		return this._isListening
	}
	public close() {
		ipc.server.stop()
		this._isListening = false
		this.log("[server#close] Server stopped.")
	}
}
