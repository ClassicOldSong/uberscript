const IS_UBER_SIGNAL = '__is_uber_singal'
const IS_UBER_OBJECT = '__is_uber_object'

const isUberSignal = sig => !!(sig && sig[IS_UBER_SIGNAL])
const isUberObject = obj => !!(obj && obj[IS_UBER_OBJECT])

let monitorCallBack = null
let disposeList = null

const monitor = (handler) => {
	const prevCallBack = monitorCallBack
	const prevDisposeList = disposeList

	let cleanup = null

	const callback = () => {
		if (cleanup) cleanup()
		cleanup = handler()
	}

	const currentDisposeList = []
	monitorCallBack = callback
	disposeList = currentDisposeList

	cleanup = handler()

	monitorCallBack = prevCallBack
	disposeList = prevDisposeList

	return () => {
		for (let i of currentDisposeList) i()
		return true
	}
}

const signal = (initVal) => {
	let val = initVal
	const receivers = new Set()
	const cleanups = new WeakMap()

	const trigger = (...args) => {
		if (!args.length) {
			if (monitorCallBack) {
				if (isUberSignal(monitorCallBack)) monitorCallBack.watch(trigger)
				else {
					disposeList.push(trigger.connect(monitorCallBack))
				}
			}
			return val
		}

		const newVal = args[0]
		const oldVal = val

		if (typeof newVal === 'function') {
			val = newVal(oldVal)
		} else {
			val = newVal
		}

		if (val !== oldVal) {
			receivers.forEach((i) => {
				const cleanup = cleanups.get(i)
				if (cleanup) {
					cleanup()
					cleanups.delete(i)
				}
				const newCleanup = i(val, oldVal)
				if (newCleanup) cleanups.set(i, newCleanup)
			})
		}
	}

	trigger.disconnect = (handler) => {
		const cleanup = cleanups.get(handler)
		if (cleanup) {
			cleanup()
			cleanups.delete(handler)
		}
		return receivers.delete(handler)
	}
	trigger.connect = (handler) => {
		receivers.add(handler)
		if (handler !== monitorCallBack) handler(val)
		return () => trigger.disconnect(handler)
	}

	Object.defineProperty(trigger, IS_UBER_SIGNAL, {
		value: true,
		editable: false
	})

	return trigger
}

const mux = (...args) => {
	const staticStrs = args.shift()
	const valList = new Array(staticStrs.length + args.length)

	let batchDepth = 0
	let handlerCount = 0
	let disconnectList = null
	let evalList = []

	let muxedSignal = null

	for (let i in staticStrs) {
		valList[i * 2] = staticStrs[i]
	}

	const strMux = signal()

	const flush = () => {
		if (batchDepth <= 0) {
			for (let i of evalList) i()
			strMux(''.concat(...valList))
			batchDepth = 0
		}
	}

	const pause = () => {
		batchDepth += 1
	}

	const resume = () => {
		batchDepth -= 1
		if (batchDepth <= 0) flush()
	}

	const batch = (handler) => {
		pause()
		handler()
		resume()
	}

	const init = () => {
		if (disconnectList) return
		pause()
		disconnectList = args.map((sig, index) => {
			index = index * 2 + 1
			if (typeof sig === 'function') {

				evalList.push(() => {
					valList[index] = sig()
				})
				if (isUberSignal(sig)) return sig.connect(flush)
				return null
			}

			valList[index] = sig
			return null
		})

		const prevCallBack = monitorCallBack
		monitorCallBack = muxedSignal
		resume()
		if (batchDepth > 0) {
			for (let i of evalList) i()
			strMux(''.concat(...valList))
		}
		monitorCallBack = prevCallBack
	}

	const destroy = () => {
		if (!disconnectList) return
		for (let i of disconnectList) {
			if (i) i()
		}
		disconnectList = null
		evalList.length = 0
		handlerCount = 0
	}

	const cleanup = () => {
		handlerCount -= 1
		if (handlerCount <= 0) destroy()
	}

	const connect = (handler) => {
		if (!handler) return strMux()

		if (!disconnectList) init()

		handlerCount += 1

		const disconnectHandler = strMux.connect(handler)

		return () => {
			if (disconnectHandler()) {
				cleanup()
				return true
			}

			return false
		}
	}

	const disconnect = (handler) => {
		if (strMux.disconnect(handler)) cleanup()
	}

	const watchingSignals = new WeakSet()

	const watch = (...signals) => {
		if (!disconnectList) init()

		for (let i of signals) {
			if (!watchingSignals.has(i)) {
				watchingSignals.add(i)
				disconnectList.push(i.connect(flush))
			}
		}

		return muxedSignal
	}

	muxedSignal = (...args) => {
		if (!args.length) {
			if (!disconnectList) init()
			return strMux()
		}
		return watch(...args)
	}

	muxedSignal.connect = connect
	muxedSignal.disconnect = disconnect
	muxedSignal.pause = pause
	muxedSignal.resume = resume
	muxedSignal.batch = batch
	muxedSignal.flush = flush
	muxedSignal.watch = watch

	Object.defineProperty(muxedSignal, IS_UBER_SIGNAL, {
		value: true,
		editable: false
	})

	return muxedSignal
}

const mapProps = (...props) => (uberObj) => {
	for (let i of props) {
		uberObj.get(i, ({$}) => () => $[i])
		uberObj.set(i, ({$}) => (val) => {
			$[i] = val
		})
	}
}

const uber = (create) => {
	const events = {}
	const getters = {}
	const setters = {}
	const methods = {}

	const uberInit = (...args) => {
		let init = null
		const setInit = (_init) => {
			init = _init
		}
		const _create = create(setInit)
		const $ = _create(...args)
		const ret = {}

		Object.defineProperty(ret, IS_UBER_OBJECT, {
			value: true,
			editable: false,
			enumerable: false
		})

		Object.defineProperty(ret, '$', {
			value: $
		})

		for (let key in setters) {
			const getter = getters[key] && getters[key](ret) || null
			const setter = setters[key](ret)

			let cleanup = null
			ret[key] = (...args) => {
				if (!args.length) {
					if (getter) return getter(ret)
					return
				}

				const newVal = args[0]

				if (cleanup) cleanup()
				if (isUberSignal(newVal)) {
					cleanup = newVal.connect(val => setter(val, newVal))
				} else {
					cleanup = setter(newVal)
				}

				return ret
			}
		}

		for (let key in getters) {
			if (!ret[key]) {
				const getter = getters[key](ret)
				ret[key] = () => getter()
			}
		}

		for (let key in methods) {
			if (!ret[key]) {
				const method = methods[key](ret)
				ret[key] = (...args) => {
					method(...args)
					return ret
				}
			}
		}

		for (let type in events) {
			if (!ret[type]) {
				const setup = events[type](ret)
				let _handler = null
				let cleanup = null

				const trigger = (...args) => _handler && _handler(...args)

				ret[type] = (handler) => {
					if (_handler && !handler) {
						cleanup()
						cleanup = null
						return ret
					}
					if (!_handler && handler) cleanup = setup(trigger)
					_handler = handler

					return ret
				}
			}
		}

		if (init) init(ret)

		return ret
	}

	uberInit.fn = (key, setup) => {
		methods[key] = setup
		return uberInit
	}

	uberInit.set = (key, setup) => {
		setters[key] = setup
		return uberInit
	}

	uberInit.get = (key, setup) => {
		getters[key] = setup
		return uberInit
	}

	uberInit.event = (type, setup) => {
		events[type] = setup
		return uberInit
	}

	uberInit.mixin = (handler) => {
		handler(uberInit)
		return uberInit
	}

	uberInit.props = (...props) => uberInit.mixin(() => {
		for (let i of props) {
			uberInit.get(i, ({$}) => () => $[i])
			uberInit.set(i, ({$}) => (val) => {
				$[i] = val
			})
		}
	})

	uberInit.methods = (...methods) => uberInit.mixin(() => {
		for (let i of methods) {
			uberInit.fn(i, ({$}) => (...args) => $[i](...args))
		}
	})

	return uberInit
}

export { uber, signal, mux, monitor, mapProps, isUberObject, isUberSignal }