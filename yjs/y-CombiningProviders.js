const Y = await import('yjs');
// const WebrtcProvider = await import('y-webrtc');
// const pkg = await import('y-websocket');
// const { WebsocketProvider } = pkg;
// const IndexeddbPersistence = await import('y-indexeddb');


const ydoc = new Y.Doc()

// this allows you to instantly get the (cached) documents data
// const indexeddbProvider = new IndexeddbPersistence('count-demo', ydoc)
// indexeddbProvider.whenSynced.then(() => {
//     console.log('loaded data from indexed db')
// })

// Sync clients with the y-webrtc provider.
// const webrtcProvider = new WebrtcProvider('count-demo', ydoc)

// Sync clients with the y-websocket provider
// const websocketProvider = new WebsocketProvider(
//     'ws://localhost:1234', 'count-demo', ydoc
// )

// array of numbers which produce a sum
const yarray = ydoc.getArray('count')

// observe changes of the sum
yarray.observe(event => {
    // print updates when the data changes
    console.log('new sum: ' + yarray.toArray().reduce((a,b) => a + b))
})

// add 1 to the sum
yarray.push([2]) // => "new sum: 1"
