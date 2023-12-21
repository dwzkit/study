import {computePosition} from "@floating-ui/dom";

const button = document.querySelector('#button');
const tooltip = document.querySelector('#tooltip');

computePosition(button, tooltip).then(({x, y}) => {
    Object.assign(tooltip.style, {
        left: `${x}px`,
        top: `${y}px`,
    });
});
