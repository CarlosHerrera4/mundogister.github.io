import Media from './Media';

import {} from 'lib-build/less!./WebScene';
import viewBlock from 'lib-build/hbars!./WebSceneBlock';
import viewBackground from 'lib-build/hbars!./WebSceneBackground';

import viewBlockError from 'lib-build/hbars!./WebSceneBlockError';
import viewBackgroundError from 'lib-build/hbars!./WebSceneBackgroundError';

import i18n from 'lib-build/i18n!./../../../../resources/tpl/builder/nls/app';

import UIUtils from 'storymaps/tpl/utils/UI';

const PREVIEW_THUMB = 'resources/tpl/builder/icons/media-placeholder/scene.png';
const PREVIEW_ICON = 'resources/tpl/builder/icons/immersive-panel/scene.png';

export default class WebScene extends Media {

  constructor(webscene) {
    super({
      type: 'webscene',
      id: webscene.id,
      previewThumb: PREVIEW_THUMB,
      previewIcon: PREVIEW_ICON
    });

    this._webscene = webscene;

    this._placement = null;

    this._isSupported = UIUtils.hasWebGL() && ! UIUtils.isMobileBrowser();

    if (! this._isSupported) {
      app.data.errorWebGL = true;
    }

    if (! this._webscene.options) {
      this._webscene.options = {
        interaction: 'enabled'
      };
    }

    if (this._webscene.slide === undefined) {
      this._webscene.slide = -1;
    }
  }

  render(context) {
    var output = '';

    if (! this._webscene || ! context) {
      console.log('Could not render webscene in section');
      return output;
    }

    this._placement = context.placement;

    if (context.placement == 'background') {

      /*
      if (! UIUtils.hasWebGL() || UIUtils.isMobileBrowser()) {
        throw 'RUNTIME-NO-WEBGL';
      }
      */

      if (this._isSupported) {
        output += viewBackground({
          id: this._domID,
          websceneId: this.id
        });
      }
      else {
        output += viewBackgroundError({
          id: this._domID
        });
      }
    }
    else {
      if (this._isSupported) {
        output += viewBlock({
          id: this._domID,
          websceneId: this.id,
          caption: this._webscene.caption,
          placeholder: i18n.builder.media.captionPlaceholder,
          captionEditable: app.isInBuilder
        });
      }
      else {
        output += viewBlockError({
          id: this._domID
        });
      }
    }

    return output;
  }

  _applyConfig() {
    var options = this._webscene.options;

    if (! this._isSupported) {
      return;
    }

    super._applyConfig(options);

    this._applyInteraction();

    this.performAction({});

    if (app.isInBuilder && this._configTabWebScene) {
      this._configTabWebScene.attachEvents();
    }
  }

  _applyInteraction() {
    // TODO: duplicate between map/scene/page should be in Media
    //  store an object for options or always use _media.options???
    if (this._webscene.options.interaction) {
      let classes = $.map(this._node.attr('class').split(' '), function(l) {
        return l.match(/interaction-/) ? l : null;
      }).join(' ');

      this._node
        .removeClass(classes)
        .addClass('interaction-' + this._webscene.options.interaction);

      this._node.find('.interaction-container').removeClass('enabled');
    }
  }

  postCreate(params = {}) {
    super.postCreate(params);

    if (! params.container) {
      return;
    }

    if (this._placement == 'block') {
      this._node = params.container.find('#' + this._domID);
    }
    else {
      this._node = params.container.find('.scene[data-id="' + this.id + '"]').parent();
    }

    this._applyConfig();
  }

  getNode() {
    return this._node;
  }

  load() {
    if (! this._node || this._isLoaded || ! this._isSupported) {
      return;
    }

    this._isLoaded = true;

    console.log('scene: ' + this.id);

    // For some reason if the require is not done there, it won't load...
    require([
      'esri4/config',
      'esri4/identity/IdentityManager',
      'esri4/identity/OAuthInfo',
      'esri4/portal/Portal',
      'esri4/views/SceneView',
      'esri4/portal/PortalItem',
      'esri4/WebScene',
      'esri4/core/watchUtils',
      'lib-build/css!esri4/css/main.css'
    ],
    function(
      esriConfig,
      esriId,
      OAuthInfo,
      Portal,
      SceneView,
      PortalItem,
      WebScene,
      watchUtils
    ) {
      function loadStep2() {
        var scene = new WebScene({
          portalItem: new PortalItem({
            id: this.id
          })
        });

        var view = new SceneView({
          map: scene,
          container: this._node.find('.scene')[0]
        });

        // Store in the section cache
        this._cache[this.id] = {
          scene: scene,
          view: view
        };

        view.then(function() {
          this._cache[this.id].initialViewpoint = view.viewpoint;

          view.ui.move('zoom', 'bottom-right');
          view.ui.move('compass', 'bottom-right');

          this._node.find('.media-loading').hide();
        }.bind(this));

        // Disable wheel
        view.surface.addEventListener('wheel', function(event) {
          event.stopImmediatePropagation();
        }, true);

        // Apply the slide
        if (this._webscene.slide !== undefined && this._webscene.slide !== -1) {
          watchUtils.init(scene, 'presentation.slides', function(slides) {
            if (slides && slides.items && slides.items.length) {
              slides.items[this._webscene.slide].applyTo(view);
            }

            if (app.isInBuilder) {
              this._onWebSceneLoaded();
            }
          }.bind(this));
        }
        else {
          if (app.isInBuilder) {
            this._onWebSceneLoaded();
          }
        }

        // The event is only registered once for all views in immersive
        this._node.find('.interaction-container').click(this._onEnableButtonClick.bind(this));
      }

      var portalUrl = app.indexCfg.sharingurl.split('/sharing/')[0];

      esriConfig.portalUrl = portalUrl;

      var info = new OAuthInfo({
        appId: app.indexCfg.oAuthAppId,
        popup: false,
        portalUrl: 'https:' + portalUrl
      });

      esriId.registerOAuthInfos([info]);

      esriId.checkSignInStatus(info.portalUrl + '/sharing').then(
        /*
        function() {
          var portal = new Portal();
          portal.authMode = 'immediate';
          portal.load().then(loadStep2.bind(this));
        }.bind(this),
        */
        loadStep2.bind(this),
        loadStep2.bind(this)
      );
    }.bind(this));
  }

  performAction() {
    var media = this._cache[this.id],
        scene = media ? media.scene : null,
        view = media ? media.view : null;

    if (! scene || ! view || ! view.ready || ! this._isSupported) {
      return;
    }

    console.log('performAction', this._webscene.slide);

    if (this._webscene.slide === -1) {
      if (this._cache[this.id].initialViewpoint) {
        view.goTo(this._cache[this.id].initialViewpoint);
      }
    }
    else if (this._webscene.slide !== undefined && this._webscene.slide <= scene.presentation.slides.items.length) {
      scene.presentation.slides.items[this._webscene.slide].applyTo(view);
    }

    this._applyInteraction();
  }

  resize() {
    //
  }
}
