import SectionCommon from 'storymaps/tpl/view/section/Common';
import UIUtils from 'storymaps/tpl/utils/UI';

import viewTpl from 'lib-build/hbars!./Title';
import {} from 'lib-build/less!./Title';

export default class Title {
  constructor(section) {
    this.type = 'title';
    this.id = UIUtils.getUID();

    this._section = section;

    this._node = null;
    this._isLoaded = false;
    this._backgroundMedia = null;
  }

  getBookmark() {
    let bookmark = this._section.bookmark || {};

    return {
      status: bookmark.enabled ? 'visible' : 'disabled',
      title: this.getPreviewText ? this.getPreviewText() : '',
      bookmark: bookmark.title || (this.getPreviewText && this.getPreviewText())
    };
  }

  getPreviewThumbnail() {
    return this._backgroundMedia.getPreviewThumbnail();
  }

  getPreviewText() {
    return this._section.foreground ? this._section.foreground.title : '';
  }

  getPreviewIcon() {
    return '';
  }

  render() {
    var background = this._section.background,
        foreground = this._section.foreground,
        classes = [];

    //
    // Options
    //

    var options = this._section.options,
        size = 'medium';

    if (options && options.size) {
      size = options.size;
    }

    classes.push('size-' + size);

    //
    // Background
    //

    // TODO: this is broken, only cover and Thin implement
    this._backgroundMedia = SectionCommon.initMedia(background);

    return viewTpl({
      classes: ['section', 'section-layout-title'].concat(classes).join(' '),
      id: this.id,
      background: SectionCommon.renderBackground({
        media: this._backgroundMedia
      }),
      title: foreground.title,
      credits: foreground.credits
    });
  }

  postCreate(sectionContainer) {
    this._node = sectionContainer;

    this._backgroundMedia.postCreate({
      container: sectionContainer,
      mediaIcon: 'image',
      onConfigAction: app.isInBuilder ? this._onMediaConfigAction.bind(this) : null,
      onToggleMediaConfig: app.isInBuilder ? this._onToggleMediaConfig.bind(this) : null,
      builderConfigurationTabs: this.MEDIA_BUILDER_TABS_BACKGROUND
    });

    /*
    $(window).scroll(function() {
      if (this._isElementInViewport($('#' + this.id))) {
        if (this._section.background.type != 'color') {
          var pos = this._getElementPos($('#' + this.id));

          if (pos > document.documentElement.clientHeight - 270) {
            pos = document.documentElement.clientHeight - 270;
          }

          //$('#' + _id).find('.image').css('backgroundPositionY', - pos);
          //$('#' + _id).find('.map').css('marginTop', - pos);
          //$('#' + _id).find('.video').css('marginTop', - pos);
        }
      }
    }.bind(this));
    */
  }

  onScroll(params) {
    if (params.status == 'unload') {
      return;
    }
    else if (params.status == 'preload') {
      if (! this._isLoaded) {
        this._backgroundMedia.load();
        this._isLoaded = true;
      }
    }
    else {
      this._backgroundMedia.performAction({
        isActive: true,
        progress: 0
      });
    }
  }

  resize(params) {
    this._backgroundMedia.resize(params);
  }

  getArcGISContent() {
    return this._backgroundMedia.getArcGISContent();
  }

  //
  // Private
  //

  /*
  _isElementInViewport(el) {
    //special bonus for those using jQuery
    if (typeof jQuery === 'function' && el instanceof jQuery) {
      el = el[0];
    }

    var rect = el.getBoundingClientRect();

    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= app.display.windowHeight,
      rect.right <= app.display.windowWidth
    );
  }

  _getElementPos(el) {
    //special bonus for those using jQuery
    if (typeof jQuery === 'function' && el instanceof jQuery) {
      el = el[0];
    }

    var rect = el.getBoundingClientRect();

    return rect.top;
  }
  */
}
