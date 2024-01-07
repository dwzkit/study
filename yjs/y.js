import * as Y from 'yjs'

const doc1 = new Y.Doc()
const doc2 = new Y.Doc()

doc1.on('update', update => {
    console.log('doc1 got an update',update)
    Y.applyUpdate(doc2, update)
})

doc2.on('update', update => {
    console.log('doc2 got an update',update)
    Y.applyUpdate(doc1, update)
})

// All changes are also applied to the other document
doc1.getArray('myarray').insert(0, ['Hello doc2, you got this?'])
doc2.getArray('myarray').insert(1, ['Hello doc1, you got this?'])
console.log(JSON.stringify(doc2.getArray('myarray'))) // => 'Hello doc2, you got this?'
