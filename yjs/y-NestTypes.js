import * as Y from 'yjs';

const doc = new Y.Doc();

const ymap = doc.getMap('map')
const foodArray = new Y.Array()
foodArray.insert(0, ['apple', 'banana'])
ymap.set('food', foodArray)
console.log("ymap.get('food') === foodArray", ymap.get('food') === foodArray) // => true
ymap.set('fruit', foodArray) // => Error! foodArray is already defined
