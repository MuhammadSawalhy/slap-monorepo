const Editor = require('@slaap/editor-widget');
const blessed = require('blessed');

// Create a screen object.
var screen = blessed.screen({
  smartCSR: true
});

screen.title = 'my window title';

// Create a box perfectly centered horizontally and vertically.
var editor = new Editor({
  parent: screen,
	gutter: {width: 0, hidden: true}
});

// Quit on Escape, q, or Control-C.
screen.key(['escape', 'q', 'C-c'], function(ch, key) {
  return process.exit(0);
});

editor.language('js')
editor.textBuf.setText('const a = 1;\nconst b = 2;\na + b;')

// Render the screen.
screen.render();
