# UberScript

Ubercharge everything with reactivity

## Usage

### Install

```shell
npm i uberscript
```

### Import

```js
import {
	uber, signal, mux, monitor, mapProps, isUberObject, isUberSignal
} from 'uberscript'
```

### Play around
```js
const uberConsole = uber(() => () => console)
.set('log', ({$}) => (val) => $.log(val))
.set('warn', ({$}) => (val) => $.warn(val))

const count = signal(0)
const myConsole = uberConsole()

myConsole.log(mux`Count is ${count}`)
myConsole.warn(mux`Doubled count is ${() => count() * 2}`)

count(i => i + 1)
```

## API

### uber

Ubercharge anything:

```js
const uberInput = uber((init) => (text) => {
	init((self) => {
		self.value(text)
		if (isUberSignal(text)) self.onInput(text)
	})
	return document.createElement('input')
})
.props('value')
.event('onInput', ({$}) => (trigger) => {
	$.addEventListener('input', () => {
		trigger($.value)
	})
	return () => $.removeEventListener('input', handler)
})
```

#### ubered.fn

#### ubered.get

#### ubered.set

#### ubered.event

#### ubered.mixin

Apply a mixin

#### ubered.props

Wrapper for `ubered.get` and `ubered.set`

#### ubered.methods

Wrapper for `ubered.fn`

### signal

Create a signal:

```js
const count = signal(0)

count.connect(val => console.log(val)) // logs 0

count += 1 // logs 1
```

### sig.connect

Connect a handler method to a signal

### sig.disconnect

Disconnect a handler method to a signal

### mux

Create a reactive string:

```js
const count = signal(0)
const countStr = mux`Count is ${count}`

countStr.connect(val => console.log(val)) // logs Count is 0

count += 1 // logs Count is 1
```

#### muxed.connect

#### muxed.disconnect

#### muxed.pause

#### muxed.resume

#### muxed.batch

#### muxed.flush

#### muxed.watch

### monitor

Auto connect current method to all signals been called inside

### mapProps

Creates a mixin that maps props automatically

### isUberObject

Checks if an object is ubered:

```js
const uberObject = uber(() => () => {})

const myObject = {}
const uberedObject = uberObject()

isUberObject(myObject) // false
isUberObject(uberedObject) // true
```

### isUberSignal

Checks if an method is an uber signal:

```js
const myFn = () => {}
const mySignal = signal(null)

isUberSignal(myFn) // false
isUberSignal(mySignal) // true
```

## License

MIT