import {} from 'lib-build/less!./Panel';

import viewInvite from 'lib-build/hbars!./PanelInvite';
import viewConfig from 'lib-build/hbars!./PanelConfig';

export default class BuilderConfig {

  constructor(params) {
    params = params || {};

    if (! params.containerInvite || ! params.containerPanel || ! params.tabs
        || ! params.media || ! params.onChange || ! params.onAction) {
      return;
    }

    this._nodeInvite = params.containerInvite;
    this._nodePanel = params.containerPanel;
    this._tabs = params.tabs;
    this._media = params.media;
    this._onChange = params.onChange;
    this._onToggle = params.onToggle;
    this._onAction = params.onAction;
    this._closeBtnStyle = params.closeBtnStyle;

    this.selectedClass = 'selected';

    this._init();
  }

  //
  // Private
  //

  _init() {
    this._nodeInvite
      .removeClass('active')
      .html(viewInvite({}));

    this._nodePanel
      .removeClass('active')
      .html(viewConfig({}));

    // Open/close button
    this._nodeInvite
      .off('click')
      .click(this._toggleConfigPanel.bind(this));

    // List of tabs
    var tabsContainer = this._nodePanel.find('.builder-tabs');
    for (let i = 0; i < this._tabs.length; i++) {
      let tab = this._tabs[i];
      tabsContainer.append(
        `<li class="tab${i === 0 ? ' selected' : ''}" data-tab="${tab.type}">` +
          `<span class="config-tab-icon fa ${tab.icon}"></span>` +
          `${tab.title}` +
        '</li>'
      );
    }

    // set one as selected.
    // attach onclick events
    var tabs = tabsContainer.find('.tab');
    // for some reason, "this" breaks
    var self = this;
    tabs.on('click', e => {
      // render the new tab, destroy the old one
      let target = $(e.currentTarget);
      let newTabType = target.data('tab');
      let oldTabType = tabsContainer.find('.tab.' + this.selectedClass).data('tab');
      let newTab = self._tabs.find(tab => newTabType === tab.type);
      let oldTab = self._tabs.find(tab => oldTabType === tab.type);

      tabs.removeClass(this.selectedClass);
      target.addClass(this.selectedClass);

      oldTab && self.destroyTab(oldTab);
      newTab && self.renderTab(newTab);
    });

    //this._onChange();
  }

  destroyTab(tab) {
    tab.destroy();
  }

  renderTab(tab) {
    let container = this._nodePanel.find('.builder-active-tab');

    container.html(tab.render());
    tab.postCreate({
      container: container,
      media: this._media,
      onChange: this._onChange,
      onAction: this._onAction,
      rootNode: this._nodePanel
    });
  }

  _toggleConfigPanel(e) {
    let inviteButton = this._nodeInvite;
    let configPanel = this._nodePanel;
    let activeClass = 'active';

    // if shutting, destroy the active panel as well
    if (configPanel.hasClass(activeClass)) {
      // when used for background media, only the x allow to close close
      if (this._closeBtnStyle == 'light' && $(e.target).hasClass('builder-invite-background')) {
        return;
      }

      // destroy the existing tab
      let tabNode = this._nodePanel.find('.builder-tabs .tab.' + this.selectedClass);
      let tabType = tabNode.data('tab');
      let openTab = this._tabs.find(tab => tabType === tab.type);

      openTab && this.destroyTab(openTab);
    }
    else {
      let tabNode = this._nodePanel.find('.builder-tabs .tab.' + this.selectedClass);
      let tabType = tabNode.data('tab');
      let openTab = this._tabs.find(tab => tabType === tab.type);

      openTab && this.renderTab(openTab);

      //this._onChange();
    }

    configPanel.toggleClass(activeClass);
    inviteButton.toggleClass(activeClass);

    if (this._onToggle) {
      this._onToggle();
    }
  }
}
