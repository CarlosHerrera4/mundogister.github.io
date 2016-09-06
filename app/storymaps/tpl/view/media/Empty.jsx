import Media from './Media';

import {} from 'lib-build/less!./Empty';
import viewTpl from 'lib-build/hbars!./Empty';

import lang from 'dojo/_base/lang';

const PREVIEW_THUMB = 'resources/tpl/builder/icons/media-placeholder/image.jpg';
const PREVIEW_ICON = 'resources/tpl/builder/icons/immersive-panel/image.png';

export default class Empty extends Media {

  constructor() {
    super({
      type: 'empty',
      id: null,
      previewThumb: PREVIEW_THUMB,
      previewIcon: PREVIEW_ICON
    });

    this._onEdit = null;
  }

  render(context) {
    if (! context) {
      console.log('Could not render webmap in section');
      return '';
    }

    if (context.placement == 'block') {
      return '';
    }
    else {
      return viewTpl({
        id: this._domID,
        label: 'Add media'
      });
    }

  }

  load() {
    //
  }

  postCreate(params = {}) {
    super.postCreate(params);

    if (! params.container) {
      return;
    }

    this._node = params.container.find('#' + this._domID).parent();

    this._node.find('.me-placeholder').css('backgroundImage', 'url("resources/tpl/builder/icons/immersive/background-placeholder.jpg")');
    this._node.find('.media-empty-add')
      .addClass('authorized-' + (params.mediaIcon || 'all'))
      .click(this.onPickMedia.bind(this));
  }

  resize() {
    //
  }

  getNode() {
    return this._node;
  }

  performAction() {
    //
  }

  //
  // Builder
  //

  serialize() {
    return lang.clone({
      type: 'empty',
      empty: 'empty'
    });
  }

  onPickMedia() {
    this._onAction('swap');
  }
}
