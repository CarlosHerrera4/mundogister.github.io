import MediumEditor from 'lib/medium-editor/dist/js/medium-editor';

/*
 * Based on Medium Insert Plugin 3.0 development branch on 04/14
 * https://github.com/orthes/medium-editor-insert-plugin
 */

import utils from './utils';
import {} from 'lib-build/less!./Core';

/*
I tested two ways to implement this
 - create a new Toolbar that we manage, we need to trigger action when a button is clicked and detect if a button is used on a paragraph
   - because MediumEditor is not flexible enough to allow us to create another of it's toolbar, it can only have one
   - there is some WIP about having different toolbar for element, that may be a solution
 - create the regular toolbar with all the options and move the dom node into our toolbar
   - very doable but tons of issues because the state of button is only checked when there is text highlighted and not just when a block is focused
   - I can't find a way to just change that simply. I tried overriding the following functions (require to load MediumEditor as AMD module and expose it as a global variable)
     but it seems more messy than first solution

The second way feels safer because we don't mess with the code to detect if a button is active.
Also not sure if there is a proper event to move the button

In the first case can't get list to work (not a problem with second way)
I am hoping first case is quite safe because all the option we are applying are block level so the quick test we are running to find if style is used may be ok and don't need to have all the complexity buit in the regular toolbar

Implemented first case and have a branch with second case

In Safari none works, the toolbar never get selected!

https://github.com/yabwe/medium-editor/issues/797
https://github.com/yabwe/medium-editor/issues/944
https://github.com/yabwe/medium-editor/blob/master/OPTIONS.md#static ?
https://github.com/yabwe/medium-editor/issues/673

https://github.com/yabwe/medium-editor/issues/385
*/

export default class Core {

  constructor(plugin) {
    this._plugin = plugin;
    this._editor = this._plugin.base;
    this._editorNode = $(this._editor.elements[0]);

    this._document = $(document);

    // Config of default medium buttons
    this._defaultButtons = MediumEditor.extensions.button.prototype.defaults;

    // Reference to regular medium editor toolbar
    this._highlightToolbar = null;
    // Reference to the default medium editor buttons replicated in the block toolbar
    this._buttonsClasses = {};

    // List of tags that are managed by the toolbar
    // TODO: See once decided on ul/ol https://github.com/yabwe/medium-editor/blob/master/src/js/util.js#L105-L113
    this._managedTagsList = [];

    // Active buttons of the current selection
    this._activeButtons = [];
    // An action has been triggered and the toolbar is not updated yet
    this._actionPendingRefresh = false;

    // Status button dom node
    this._button = null;
    // Block toolbar dom node
    this._blockToolbar = null;

    // Keep a reference to constructor global selection object (babel issue otherwise)
    this._selection = MediumEditor.selection;

    this.init();
    this.createToolbar();
    this.initEvents();
  }

  selectElement(el) {
    this.selectedElement = el;
  }

  getSelectedElement() {
    return this.selectedElement;
  }

  init() {
    const buttons = this._plugin.getButtons();

    buttons.forEach((name) => {
      this._buttonsClasses[name] = this._editor.addBuiltInExtension(name);
      this._managedTagsList = this._managedTagsList.concat(this._buttonsClasses[name].tagNames);
    });

    // p is not listed otherwise
    this._managedTagsList.push('p');

    // Filter out duplicate values
    this._managedTagsList = this._managedTagsList.filter((elem, pos, arr) => {
      return arr.indexOf(elem) == pos;
    });

    // Store a reference to the regular medium editor toolbar
    // TODO find a better way to do this
    setTimeout(function() {
      this._editor.extensions.forEach((extension) => {
        if (extension.name == 'toolbar') {
          this._highlightToolbar = extension;
        }
      });
    }.bind(this), 1000);
  }

  createToolbar() {
    const buttons = this._plugin.getButtons(),
        mediumButtons = MediumEditor.extensions.button.prototype.defaults;

    let html;

    this._button = document.createElement('div');
    this._button.classList.add('block-toolbar-button');
    this._button.setAttribute('contentediable', false);

    this._button.innerHTML = html;
    document.body.appendChild(this._button);

    this._blockToolbar = document.createElement('div');
    this._blockToolbar.classList.add('block-toolbar-buttons');
    this._blockToolbar.classList.add('medium-toolbar-arrow-under');
    this._blockToolbar.setAttribute('contentediable', false);

    html = '<ul>';

    buttons.forEach((name) => {
      if (mediumButtons[name]) {
        var btnTag = mediumButtons[name].contentFA;

        // TODO: half the button seems to miss that -> report
        if (! btnTag.match(/<\/i>$/)) {
          btnTag += '</i>';
        }

        html += `<li><a class="block-button" data-button="${name}">${btnTag}</a></li>`;
      }
    });

    html += '</ul>';

    this._blockToolbar.innerHTML = html;
    document.body.appendChild(this._blockToolbar);
  }

  initEvents() {
    // This could be chained when medium-editor 5.15.2 is released
    // https://github.com/yabwe/medium-editor/pull/1046
    this._plugin.on(document, 'click', this.updateToolbar.bind(this));
    this._plugin.on(document, 'keyup', this.updateToolbar.bind(this));
    this._plugin.on(this._button, 'click', this.toggleToolbar.bind(this));

    var buttons = this._blockToolbar.getElementsByClassName('block-button');
    Array.prototype.forEach.call(buttons, (button) => {
      this._plugin.on(button, 'click', this.handleButtonClick.bind(this));
    });

    this._plugin.on(window, 'resize', this.positionToolbar.bind(this));

    this._editor.subscribe('showToolbar', function() {
      this.hideToolbar();
    }.bind(this));
  }

  destroy() {
    this._button.remove();
    this._blockToolbar.remove();
  }

  positionToolbar() {
    let el,
        elPosition,
        position;

    // Don't position buttons if they aren't active
    if (this._button.classList.contains('active') === false) {
      return;
    }

    el = this._editor.getSelectedParentElement();

    // If the element is not a root block
    if (this._managedTagsList.indexOf(el.tagName.toLowerCase()) < 0) {
      // Find it
      el = $(el).closest(this._managedTagsList.join(','))[0];

      // Check that it's still an editor child
      if (! this.shouldDisplayButtonsOnElement(el)) {
        return;
      }
    }

    elPosition = el.getBoundingClientRect();

    // Calculate position
    position = {
      top: this.getScrollY() + elPosition.top,
      left: (window.scrollX || 0) + elPosition.left /*- parseInt(addonsStyle.left, 10)*/ /*- parseInt(addonButtonStyle.marginLeft, 10)*/
    };

    if ($(el).is('h1')) {
      position.top = position.top + 10;
    }

    position.left -= 35;

    // If left position is lower than 0, the buttons would be out of the viewport.
    // In that case, align buttons with the editor
    position.left = position.left < 0
      ? elPosition.left
      : position.left;

    this._button.style.left = `${position.left}px`;
    this._button.style.top = `${position.top}px`;

    this._blockToolbar.style.top = `${position.top - 48}px`;
    this._blockToolbar.style.left = `${position.left - 10}px`;
  }

  updateToolbar(e) {
    var target = $(e.target);

    if (! this._editorNode.has(target).length && ! this._actionPendingRefresh) {
      // Might have clicked on placeholder?
      if (! (target.is(this._editor.elements[0])
          && $(this._editor.elements[0]).find('.block').length == 1
          && $(this._editor.elements[0]).find('.block').eq(0).html() == '')) {
        return;
      }
    }

    this.updateToolbarForElement(this._editor.getSelectedParentElement());
  }

  updateToolbarForElement(el) {
    if (this._highlightToolbar && this._highlightToolbar.multipleBlockElementsSelected()) {
      this.hideToolbarAndButton();
      return;
    }

    if (! this.shouldDisplayButtonsOnElement(el)) {
      this.hideToolbarAndButton();
      return;
    }

    if ($(el).hasClass('block-caption')) {
      this.hideToolbarAndButton();
      return;
    }

    /*
    if (el.tagName.toLowerCase() == 'li') {
      el = el.parentNode;
    }*/

    var isNewBlockSelected = el != this.getSelectedElement();

    // First selection
    if (this.getSelectedElement() == null) {
      isNewBlockSelected = false;
    }
    // Click on the button (in most browser)
    else if ($(el).hasClass('block-toolbar-button-status')) {
      isNewBlockSelected = false;
    }
    // User just realized an action and some of them will change the markup
    //  so el != this.getSelectedElement()
    else if (this._actionPendingRefresh) {
      isNewBlockSelected = false;
      this._actionPendingRefresh = false;
    }

    // Hide toolbar when new block is selected
    if (isNewBlockSelected) {
      this.hideToolbar();
    }

    this.selectElement(el);
    this.showButtons();
  }

  shouldDisplayButtonsOnElement(el) {
    let belongsToEditor = false;

    // Don't show buttons when the editor doesn't belong to editor
    this._plugin.getEditorElements().forEach((editor) => {
      if (utils.isChildOf(el, editor)) {
        belongsToEditor = true;
        return;
      }
    });

    if (! belongsToEditor) {
      return false;
    }

    return true;
  }

  // The toolbar is displayed
  showButtons() {
    const buttons = this._plugin.getButtons();

    var activeButtons = [];

    //
    // Query editor to know what buttons are active
    //  - reflect button in toolbar
    //  - update the block status
    //

    // Find what buttons are active
    buttons.forEach((name) => {
      var isActive = false;

      if (this._plugin.getQueryStateMethods()[name] == 'ALREADY_APLLIED') {
        isActive = this._buttonsClasses[name].isAlreadyApplied(this.getSelectedElement());
      }
      else {
        isActive = this._editor.queryCommandState(name);
      }

      if (isActive) {
        activeButtons.push(name);
      }
    });

    // Update the buttons status
    buttons.forEach((name) => {
      var isActive = activeButtons.indexOf(name) > -1;
      $('.block-button[data-button=' + name + ']').toggleClass('active', isActive);
    });

    var activeButton = 'justifyLeft';

    if (activeButtons.length) {
      if(activeButtons.indexOf('h1') > -1) {
        activeButton = 'h1';
      }
      else if(activeButtons.indexOf('h2') > -1) {
        activeButton = 'h2';
      }
      else if(activeButtons.indexOf('quote') > -1) {
        activeButton = 'quote';
      }
      else {
        activeButton = activeButtons[0];
      }
    }
    // For IE
    else {
      activeButtons = [activeButton];
      $('.block-button[data-button=' + activeButton + ']').toggleClass('active', true);
    }

    // Set the button icon
    this._button.innerHTML = `<a class="block-toolbar-button-status">${this._defaultButtons[activeButton].contentFA}</a>`;

    // Display and position the toolbar
    this._button.classList.add('active');
    this.positionToolbar();
    this._activeButtons = activeButtons;
  }

  toggleToolbar() {
    this._button.classList.toggle('buttons-active');
    this._blockToolbar.classList.toggle('active');
  }

  hideToolbar() {
    this._button.classList.remove('buttons-active');
    this._blockToolbar.classList.remove('active');
  }

  hideToolbarAndButton() {
    this._button.classList.remove('active');
    this._button.classList.remove('buttons-active');
    this._blockToolbar.classList.remove('active');
  }

  handleButtonClick(e) {
    const name = e.currentTarget.getAttribute('data-button');

    this._actionPendingRefresh = true;

    // Select the whole block
    this._selection.selectNode(this.getSelectedElement(), document);

    // TODO cleanup
    // h1, h2 and quote cannot be mixed in all browser (but chrome)
    if (name == 'quote') {
      if (this._activeButtons.indexOf('h1') > -1) {
        this._editor.execAction(this._defaultButtons['h1'].action);
      }
      else if (this._activeButtons.indexOf('h2') > -1) {
        this._editor.execAction(this._defaultButtons['h2'].action);
      }
      // TODO deal with lists
      // see https://github.com/yabwe/medium-editor/issues/1068
    }
    else if (name == 'h1' || name == 'h2') {
      if (this._activeButtons.indexOf('quote') > -1) {
        this._editor.execAction(this._defaultButtons['quote'].action);
      }
      else if (this._activeButtons.indexOf('orderedlist') > -1) {
        this._editor.execAction(this._defaultButtons['orderedlist'].action);
      }
      else if (this._activeButtons.indexOf('unorderedlist') > -1) {
        this._editor.execAction(this._defaultButtons['unorderedlist'].action);
      }
    }
    /*
    else if (name == 'orderedlist' || name == 'unorderedlist') {
      if (this._activeButtons.indexOf('quote') > -1) {
        this._editor.execAction(this._defaultButtons['quote'].action);
      }
      else if (this._activeButtons.indexOf('h1') > -1) {
        this._editor.execAction(this._defaultButtons['h1'].action);
      }
      else if (this._activeButtons.indexOf('h2') > -1) {
        this._editor.execAction(this._defaultButtons['h2'].action);
      }
    }
    */

    if (this._defaultButtons[name]) {
      this._editor.execAction(this._defaultButtons[name].action);
    }

    this.hideEditorToolbar();
    this._selection.clearSelection(document);

    e.preventDefault();
  }

  hideEditorToolbar() {
    setTimeout(function() {
      this._highlightToolbar.hideToolbar();
    }.bind(this), 0);

    setTimeout(function() {
      this._highlightToolbar.hideToolbar();
    }.bind(this), 10);

    setTimeout(function() {
      this._highlightToolbar.hideToolbar();
    }.bind(this), 50);
  }

  getScrollY() {
    return this._document.scrollTop();
  }
}
