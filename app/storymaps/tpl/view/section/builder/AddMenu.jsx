import {} from 'lib-build/less!./AddMenu';
import viewTpl from 'lib-build/hbars!./AddMenu';

const BUTTONS = {
  sequence: {
    name: 'sequence',
    icon: 'resources/tpl/builder/icons/text-editor/Text.png',
    label: 'Sequential'
  },
  title: {
    name: 'title',
    icon: 'resources/tpl/builder/icons/text-editor/Title.png',
    label: 'Title'
  },
  immersive: {
    name: 'immersive',
    icon: 'resources/tpl/builder/icons/text-editor/Immersive.gif',
    //iconHover: 'resources/tpl/builder/icons/text-editor/Immersive-hover.gif',
    label: 'Immersive'
  }
};

export default class AddMenu {
  constructor(params = {}) {
    this._container = null;
    this._sectionContainer = null;

    this._buttons = [];

    if (params.buttons && params.buttons.length) {
      for (var button of params.buttons) {
        this._buttons.push(BUTTONS[button]);
      }
    }
  }

  postCreate(params = {}) {
    this._container = params.container;
    this._sectionContainer = params.sectionContainer;

    this._container
      .html(this._render())
      .mouseleave(this._onMenuMouseleave.bind(this))
      .find('.add-button').click(this._onButtonClick.bind(this));

    this._sectionContainer
      .click(this._onSectionClick.bind(this))
      .mousemove(this._onSectionMouseMove.bind(this))
      .mouseleave(this._onSectionMouseleave.bind(this));
  }

  _render() {
    var buttonsHTML = '';

    for (var button of this._buttons) {
      let name = button.name;
      let icon = button.icon || '';
      let iconHover = button.iconHover || '';
      let iconNode = `<img class="add-button-icon" src="${icon}" />`;

      buttonsHTML += `<li><a class="add-button" data-button="${name}" data-icon="${icon}" data-icon-hover="${iconHover}">${iconNode} ${button.label}</a></li>`;
    }

    return viewTpl({
      buttons: buttonsHTML
    });
  }

  show() {
    this._container.addClass('active');
  }

  _onSectionClick(e) {
    let targetPosition = e.currentTarget.getBoundingClientRect();

    if (e.clientY - 15 < targetPosition.top) {
      this.show();
    }
  }

  _onSectionMouseMove(e) {
    var targetPosition = e.currentTarget.getBoundingClientRect();
    var isOnAddInvite = e.clientY - 15 < targetPosition.top;

    this._sectionContainer.toggleClass('show-add-section-menu', isOnAddInvite)
      // For Safari, also an issue on IE but doesn't help
      .css('cursor', isOnAddInvite ? 'hand' : 'default');
  }

  _onSectionMouseleave() {
    this._sectionContainer
      .toggleClass('show-add-section-menu', false)
      .css('cursor', 'default');

    this._container.removeClass('active');
  }

  _onMenuMouseleave() {
    this._onSectionMouseleave();
  }

  _onButtonClick(e) {
    var target = $(e.currentTarget);

    var newSectionIndex = this._sectionContainer.index() - 1;

    // If the section is credits, need to skip credits placeholder
    if (this._sectionContainer.hasClass('section-layout-credits')) {
      newSectionIndex--;
    }

    app.Controller.addSection({
      type: target.data('button'),
      index: newSectionIndex
    });
  }
}
