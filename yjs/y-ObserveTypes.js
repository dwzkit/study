import * as Y from 'yjs';

// Observe types
const doc = new Y.Doc();
const yarray = doc.getArray('my-array')
yarray.observe(event => {
    console.log('yarray was modified')
})
// every time a local or remote client modifies yarray, the observer is called
yarray.insert(0, ['val']) // => "yarray was modified"
