import Media from './Media';

import {} from 'lib-build/less!./WebMap';
import viewBlock from 'lib-build/hbars!./WebMapBlock';
import viewBackground from 'lib-build/hbars!./WebMapBackground';

import i18n from 'lib-build/i18n!./../../../../resources/tpl/builder/nls/app';

import MapCommand from 'storymaps/tpl/view/media/arcgis/WebMapCommand';

import arcgisUtils from 'esri/arcgis/utils';
import Extent from 'esri/geometry/Extent';
import SimpleMarkerSymbol from 'esri/symbols/SimpleMarkerSymbol';
import webMercatorUtils from 'esri/geometry/webMercatorUtils';
import Point from 'esri/geometry/Point';
import Query from 'esri/tasks/query';
import QueryTask from 'esri/tasks/QueryTask';

import esriConfig from 'esri/config';
import lang from 'dojo/_base/lang';
import Deferred from 'dojo/Deferred';

import UIUtils from 'storymaps/tpl/utils/UI';

const PREVIEW_THUMB = 'resources/tpl/builder/icons/media-placeholder/map.png';
const PREVIEW_ICON = 'resources/tpl/builder/icons/immersive-panel/map.png';

export default class WebMap extends Media {

  constructor(webmap) {
    super({
      type: 'webmap',
      id: webmap.id,
      previewThumb: PREVIEW_THUMB,
      previewIcon: PREVIEW_ICON
    });

    this._webmap = webmap;
    this._bookmarks = null;

    this._placement = null;

    // The transition in Immersive, null otherwise
    this._transition = null;
    // DOM node of the layers that are swiped
    this._swipeLayersNodes = [];
    // Store the previous maap configuration that layer may be swiped against
    //  while the map is loading
    this._swipePreviousWebMapLayers = null;
    this._lastScrollPosition = null;

    if (! this._webmap.options) {
      this._webmap.options = {
        interaction: 'enabled'
      };
    }

    if (! this._webmap.extras) {
      this._webmap.extras = {
        locate: {
          enabled: false
        },
        search: {
          enabled: false
        },
        legend: {
          enabled: false
        }
      };
    }
  }

  render(context) {
    var output = '';

    if (! this._webmap || ! context) {
      console.log('Could not render webmap in section');
      return output;
    }

    this._placement = context.placement;

    if (this._placement == 'block') {
      var options = JSON.stringify({
        extent: this._webmap.extent,
        layers: this._webmap.layers,
        legend: this._webmap.legend,
        layers2: this._webmap.layers2
      });

      var classes = ['block', 'block-type-webmap'];

      output += viewBlock({
        id: this._domID,
        webmapId: this.id,
        classes: classes.join(' '),
        options: options,
        caption: this._webmap.caption,
        placeholder: i18n.builder.media.captionPlaceholder,
        captionEditable: app.isInBuilder
      });
    }
    else {
      output += viewBackground({
        webmapId: this.id
      });
    }

    return output;
  }

  _applyConfig() {
    var options = this._webmap.options;

    super._applyConfig(options);

    this._applyInteraction();

    // In viewer: update map extent if defined
    // In builder: update map extent only on reset
    let allowExtentUpdate = !! (this._webmap.extent || app.isInBuilder);
    /*
    if (app.isInBuilder) {
      allowExtentUpdate = this._webmap.extent == null;
    }
    */

    // TODO: background - swipe need scrollPosition
    this.performAction({
      allowExtentUpdate: allowExtentUpdate
    }).then(
      function() {
        if (app.isInBuilder && this._configTabWebMap) {
          this._configTabWebMap.attachEvents();
        }
      }.bind(this),
      function() {
        //
      }
    );
  }

  _applyInteraction() {
    let interaction = this._webmap.options.interaction;

    if (app.isMobileView || UIUtils.isMobileBrowser()) {
      interaction = 'button';
    }

    // TODO: duplicate between map/scene/page should be in Media
    //  store an object for options or always use _media.options???

    if (this._webmap.options.interaction) {
      let classes = $.map(this._node.attr('class').split(' '), function(l) {
        return l.match(/interaction-/) ? l : null;
      }).join(' ');

      this._node
        .removeClass(classes)
        .addClass('interaction-' + interaction);

      this._node.find('.interaction-container').removeClass('enabled');
    }
  }

  /*
   * load is only called once for the media in an Immersive section
   *   This let the section knows when loading is complete so postLoad()
  *    can be called for each view
   */
  load() {
    var resultDeferred = new Deferred();

    if (! this._node || this._isLoaded) {
      return;
    }

    this._isLoaded = true;

    this.loadMap(
      this._node.find('.map')[0],
      resultDeferred
    );

    return resultDeferred;
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
      this._node = params.container.find('.map[data-id="' + this.id + '"]').parent();
    }

    this._applyConfig();
  }

  getNode() {
    return this._node;
  }

  resize() {
    //
  }

  performAction(params = {}) {
    var resultDeferred = new Deferred();
    var map = this._cache[this.id] ? this._cache[this.id].map : null;

    if (! map) {
      resultDeferred.reject();
      return resultDeferred;
    }

    if (params.scrollPositionView) {
      this._lastScrollPosition = params.scrollPositionView;
    }

    if (params.transition) {
      this._transition = params.transition;
    }

    /*
    if (! _bookmarks) {
      return;
    }
    */

    /*
    if (_bookmarks && _currentBookmarkIndex != params.slideIndex) {
      var bookmark = _bookmarks[params.slideIndex - 1];

      if (bookmark && bookmark.extent) {
        map.setExtent(new Extent(bookmark.extent), false);
      }

      _currentBookmarkIndex = params.slideIndex;
    }
    */

    // TODO: Should only apply changes when changing slide

    if (map.infoWindow) {
      map.infoWindow.hide();
    }

    // Apply view configuration
    var viewInfo = this._webmap;

    var hasChangedExtent = false;

    // In viewer if viewInfo.extent is set it's applied
    // In builder it's always ignored except if forceExtentUpdate
    // True when come from inside the class ; undefined from the section
    if (params.allowExtentUpdate === true || params.allowExtentUpdate === undefined) {
      let extent = null;

      if (viewInfo.extent) {
        extent = new Extent(viewInfo.extent);
      }
      else {
        // Initial extent
        //extent = map._params.extent;
        extent = this._getWebMapExtentFromItemExtent(
          this._cache[this.id].itemInfo.item.extent
        );
      }

      // Only apply if last extent applied was different
      if (JSON.stringify(extent.toJson()) != this._cache[this.id].lastExtentApplied || params.forceSetExtent) {
        this._cache[this.id].lastExtentApplied = JSON.stringify(extent.toJson());

        hasChangedExtent = true;

        map.setExtent(extent, false).then(
          function() {
            if (viewInfo.popup) {
              this._applyPopupConfiguration(map, viewInfo.popup);
            }

            resultDeferred.resolve();
          }.bind(this),
          function() {
            resultDeferred.resolve();
          }
        );
      }
    }
    else {
      resultDeferred.resolve();
    }

    // Popup
    if (viewInfo.popup && ! hasChangedExtent) {
      this._applyPopupConfiguration(map, viewInfo.popup);
    }

    // Apply layer config if it's a new view
    //if (params.isNewView) {
    //if (viewInfo.layers) {
    //if (false) {
    if (JSON.stringify(viewInfo.layers) != this._cache[this.id].lastLayersApplied) {
      this._cache[this.id].lastLayersApplied = JSON.stringify(viewInfo.layers);

      //  - Array of {id:'', visible:''} for the overrided layers (compared to the webmap initial state)
      //  - Only overrided layers are present there to allow the webmap to evolve outside of the app
      //     - If default visibility of layers are changed outside of the app, all view that didn't override the value will see the change
      //     - if the webmap evolve the array may reference deleted layers. That's cleaned anytime user open the Configure map View and Save
      var layerCfg = viewInfo.layers || [];
      var mapDefault = this._cache[viewInfo.id].itemInfo.itemData.operationalLayers;

      // Loop through webmap layers and set the visibility
      // The visibility is set to the section definition when defined or to the webmap initial visibility
      $.each(mapDefault, function(i, layer) {
        var override;

        if (layer.layerObject) {
          override = $(layerCfg).filter(function(i, l) {
            return l.id == layer.layerObject.id;
          });
          layer.layerObject.setVisibility(override.length ? override[0].visibility : layer.visibility);
        }
        else if (layer.featureCollection && layer.featureCollection.layers) {
          $.each(layer.featureCollection.layers, function(i, fcLayer) {
            override = $(layerCfg).filter(function(i, l) {
              // Because the configuration store the map layerObject id like "mapNotes_914_0" instead of "mapNotes_914"
              // Should change that and keep V1.0 compatibility
              return l.id.split('_').slice(0,-1).join('_') == fcLayer.layerObject.id.split('_').slice(0,-1).join('_');
            });
            fcLayer.layerObject.setVisibility(override.length ? override[0].visibility : fcLayer.visibility);
          });
        }
      });
    }

    if (this._transition == 'swipe-vertical' || this._transition == 'swipe-horizontal') {
      if (this._swipeLayersNodes && this._swipeLayersNodes.length) {
        // TODO: refactor to be common with Immersive???

        let swipePos = app.display.windowHeight - this._lastScrollPosition;

        const BUILDER_PANEL_HEIGHT = 125;
        if (app.isInBuilder) {
          swipePos -= BUILDER_PANEL_HEIGHT;
        }

        /*
        if (! params.isActive) {
          swipePos = app.display.windowHeight;
        }
        */
        /*
        else {
          swipePos += app.display.windowHeight / 2 - 90;
        }
        */

        for (let layer of this._swipeLayersNodes) {
          let layerNode = layer.node,
              top = swipePos,
              right = app.display.windowWidth,
              bottom = app.display.windowHeight,
              left = 0;

          if (! layer.isSVGLayer) {
            let layerPos = layerNode.position();

            top += - layerPos.top;
            right += - layerPos.left;
            bottom += - layerPos.top;
            left += - layerPos.left;
          }

          layerNode.css(
            'clip',
            'rect(' + top + 'px,' + right + 'px,' + bottom + 'px,' + left + 'px)'
          );

          // Keep track of the swipe position for pan
          layerNode.data('sm-swipe-pos', swipePos);
        }
      }
    }
    else {
      this.resetSwipe();
    }

    if (! params.doNotApplyInteraction) {
      this._applyInteraction();
    }

    // Locate
    let enableLocate = false;
    if (this._webmap.extras && this._webmap.extras.locate && this._webmap.extras.locate.enabled) {
      enableLocate = true;
    }
    this._cache[this.id].mapCommand.toggleLocationButton(enableLocate);

    return resultDeferred;
  }

  resetSwipe() {
    for (let layer of this._swipeLayersNodes) {
      let layerNode = layer.node;

      layerNode.css(
        'clip',
        ''
      );

      layerNode.data('sm-swipe-pos', '');
    }
  }

  loadMap(mapElem, resultDeferred) {
    console.log('Loading map');

    var options = {
      mapOptions: {
        smartNavigation: false
      },
      usePopupManager: true,
      editable: false,
      bingMapsKey: app.cfg.BING_MAPS_KEY,
      layerMixins: app.data.appProxies || null
    };

    if (this._webmap.extent) {
      options.mapOptions.extent = new Extent(this._webmap.extent);
    }

    // Prevent mouse wheel while map is partialy loaded
    $(mapElem).css('pointer-events', 'none');

    arcgisUtils.createMap(this.id, mapElem, options).then(lang.hitch(this, function(response) {
      var map = response.map;

      console.log('createMap ok', response);

      this._node.find('.media-loading').hide();

      //response.map.disableMapNavigation();
      // Prevent mouse wheel while map is partialy loaded
      $(mapElem).css('pointer-events', '');
      map.disableScrollWheelZoom();

      map.reposition();
      map.resize();

      this._cache[this.id] = response;

      if (app.isInBuilder) {
        this._onWebMapLoaded();
      }

      this._bookmarks = response.itemInfo.itemData.bookmarks;

      if (map.infoWindow) {
        map.infoWindow.markerSymbol = new SimpleMarkerSymbol().setSize(0);
      }

      // Let the section knows the map is loaded
      resultDeferred.resolve(this.id);

      // The event is only registered once for all views in immersive
      this._node.find('.interaction-container').click(this._onEnableButtonClick.bind(this));

      // Customize map commands +/home/- & location
      this._cache[this.id].mapCommand = new MapCommand(
        map,
        this._onMapCommandHomeClick.bind(this),
        this._zoomToBrowserLocation.bind(this),
        false
      );

      this._cache[this.id].lastExtentApplied = null;
      this._cache[this.id].lastLayersApplied = null;

      this._applyConfig();
    }));
  }

  postLoad() {
    let map = this._cache[this.id].map;

    this.computeSwipeLayers(this._swipePreviousWebMapLayers);

    // Pan handler to update swiped layer(s)
    map.on('pan', function() {
      // TODO: this._isActive should be set when performAction is called properly
      // but we don't have performAction when it's becoming not visible :/
      if (! this._swipeLayersNodes || ! this._isActive) {
        return;
      }

      for (let layer of this._swipeLayersNodes) {
        let layerNode = layer.node,
            swipePos = layerNode.data('sm-swipe-pos');

        let top = swipePos,
            right = app.display.windowWidth,
            bottom = app.display.windowHeight,
            left = 0;

        if (! layer.isSVGLayer) {
          let layerPos = layerNode.position();

          top += - layerPos.top;
          right += - layerPos.left;
          bottom += - layerPos.top;
          left += - layerPos.left;
        }

        layerNode.css(
          'clip',
          'rect(' + top + 'px,' + right + 'px,' + bottom + 'px,' + left + 'px)'
        );
      }
    });
  }

  _zoomToBrowserLocation(success, geom) {
    var map = this._cache[this.id] ? this._cache[this.id].map : null;

    if(success) {
      if (map.spatialReference.wkid != 102100 && map.spatialReference.wkid != 4326) {
        esriConfig.defaults.geometryService.project([geom], map.spatialReference, function(features) {
          if(! features || ! features[0]) {
            return;
          }

          if (! map.extent.contains(features[0])) {
            map.centerAt(features[0]);
          }
        });
      }
      else if (! map.extent.contains(geom)) {
        map.centerAt(geom);
      }
    }
  }

  _onMapCommandHomeClick() {
    this.performAction({
      doNotApplyInteraction: true,
      forceSetExtent: true
    });
  }

  //
  // Swipe
  //

  /*
   * Compute the layers to be swiped for this map
   *   by passing the previous map layer configuration
   * This is performed in viewer at runtime from the layer configuration
   * This is performed in builder when configuration of both media change
   *
   */
  computeSwipeLayers(previousWebMapLayers) {
    this._swipeLayersNodes = [];
    this._swipePreviousWebMapLayers = [];

    previousWebMapLayers = previousWebMapLayers || [];
    this._webmap.layers = this._webmap.layers || [];

    // The map hasn't loaded yet, save the list of previousWebMapLayers for after map has loaded
    if (! this._cache[this.id]) {
      this._swipePreviousWebMapLayers = lang.clone(previousWebMapLayers);
      return;
    }

    /*
     * Stringify the layers config so they are comparable
     */
    var previousLayersComparable = [],
        currentLayersComparable = [];

    for (let layer of previousWebMapLayers) {
      previousLayersComparable.push(JSON.stringify(layer));
    }

    for (let layer of this._webmap.layers) {
      currentLayersComparable.push(JSON.stringify(layer));
    }

    // Add opposite entry for layer override set to false for previous map
    // This allow to use a webmap that has all it's layer visible and the first map is setting
    //  the visibility of one layer to false
    for (let layer of previousLayersComparable) {
      // If the layer is not present
      if (currentLayersComparable.indexOf(layer) == -1) {
        var layerObj = JSON.parse(layer);
        if (layerObj.visibility === false) {
          currentLayersComparable.push(JSON.stringify({
            id: layerObj.id,
            visibility: true
          }));
        }
      }
    }

    /*
     * Get the difference between arrays
     */
    let previousLayersSet = new Set(previousLayersComparable);
    let difference = currentLayersComparable.filter(function(layer) {
      return ! previousLayersSet.has(layer);
    });

    /*
     * Find the DOM node for those
     */

    let isFirstSVGLayer = true;

    for (let layer of difference) {
      let layerId = JSON.parse(layer).id,
          layerNode = this._cache[this.id].map.getLayer(layerId)._div,
          isSVGLayer = false;

      // A graphics Layer drawned as SVG
      // Those behave a little differently as there is only one swippeable
      //   container for all of them in the map
      // So those are only initialized once
      if (layerNode.rawNode) {
        if (! isFirstSVGLayer) {
          continue;
        }

        layerNode = $(layerNode.rawNode).parent()[0];
        isSVGLayer = true;
        isFirstSVGLayer = false;
      }

      this._swipeLayersNodes.push({
        node: $(layerNode),
        isSVGLayer: isSVGLayer
      });
    }

    console.log('**', this._swipeLayersNodes);
  }

  // serialize needed for getAuthorizedTransitionsWith
  // TODO review this
  serialize() {
    return lang.clone({
      type: 'webmap',
      webmap: this._webmap
    });
  }

  getAuthorizedTransitionsWith(media) {
    if (! media || media.id != this.id) {
      return [];
    }

    var mediaData = this.serialize().webmap,
        mediaExtent = JSON.stringify(mediaData.extent) || 'null',
        mediaLayers = JSON.stringify(mediaData.layers) || '[]',
        mediaPopup = JSON.stringify(mediaData.popup) || 'null';

    var otherMediaData = media.serialize().webmap,
        otherMediaExtent = JSON.stringify(otherMediaData.extent) || 'null',
        otherMediaLayers = JSON.stringify(otherMediaData.layers) || '[]',
        otherMediaPopup = JSON.stringify(otherMediaData.popup) || 'null';

    // If popup or location are different, can't swipe
    if (mediaPopup != otherMediaPopup || mediaExtent != otherMediaExtent) {
      return [];
    }

    // Do not allow swipe if extent is not configured
    if (mediaLayers == otherMediaLayers) {
      return [];
    }

    return ['swipe-vertical'/*, 'swipe-horizontal'*/];
  }

  getLayersConfiguration() {
    return this._webmap.layers;
  }

  // TODO: support any projection
  _getWebMapExtentFromItemExtent(itemExtent) {
    if(! itemExtent || itemExtent.length != 2) {
      return null;
    }

    var bottomLeft = webMercatorUtils.geographicToWebMercator(
      new Point(
        itemExtent[0][0],
        itemExtent[0][1]
      )
    );

    var topRight = webMercatorUtils.geographicToWebMercator(
      new Point(
        itemExtent[1][0],
        itemExtent[1][1]
      )
    );

    // TODO: if map is not in Mercator -> reproject

    return new Extent({
      xmax: topRight.x,
      xmin: bottomLeft.x,
      ymax: topRight.y,
      ymin: bottomLeft.y,
      spatialReference: {
        wkid: 102100
      }
    });
  }

  //
  // Popup
  //

  _applyPopupConfiguration(map, popupCfg) {
    // When an action is performed the popup will be closed
    // But features aren't cleared so it can be restored
    map.infoWindow.hide();

    if (popupCfg) {
      var layer = map.getLayer(popupCfg.layerId),
          // TODO some MapService layer seems to require this
          // need to investigate more to make sure there is no other way
          // also if the popup contains multiple features, only the first feature will be displayed
          serviceId = popupCfg.layerId ? popupCfg.layerId.split('_').slice(0, -1).join('_') : '',
          layer2 = map.getLayer(serviceId);

      map.infoWindow.clearFeatures();

      if (layer) {
        this._applyPopupConfigurationStep2(map, popupCfg);
      }
      // TODO
      else if (layer2) {
        var layerIdx = popupCfg.layerId.split('_').slice(-1).join('_'),
            layerUrl = layer2.url + '/' + layerIdx;

        this._applyPopupConfigurationStep2Alt(map, popupCfg, serviceId, layerIdx, layerUrl);
      }
      // On FS the layer will be null until loaded...
      else
        var handle = map.on('update-end', function() {
          this._applyPopupConfiguration(map, popupCfg);
          handle.remove();
        });
    }
  }

  _applyPopupConfigurationStep2(map, popupCfg) {
    var query = new Query(),
        layer = map.getLayer(popupCfg.layerId);

    if (! layer) {
      return;
    }

    query.objectIds = [popupCfg.fieldValue];

    // Feature Service
    if (! layer._collection) {
      query.returnGeometry = true;
      query.outFields = ['*']; // popupCfg.fieldName ?
      query.outSpatialReference = map.spatialReference;
    }

    // TODO: Image Services
    if (! layer.queryFeatures) {
      return;
    }

    layer.queryFeatures(query).then(function(featureSet) {
      this._applyPopupConfigurationStep3(map, popupCfg, featureSet.features);
    }.bind(this));
  }

  // TODO
  _applyPopupConfigurationStep2Alt(map, popupCfg, serviceId, layerIdx, layerUrl) {
    var queryTask = new QueryTask(layerUrl),
        query = new Query(),
        layer = map.getLayer(serviceId);

    if (! layer) {
      return;
    }

    query.objectIds = [popupCfg.fieldValue];
    query.returnGeometry = true;
    query.outFields = ['*']; // popupCfg.fieldName ?
    query.outSpatialReference = map.spatialReference;

    queryTask.execute(query, function(featureSet) {
      this._applyPopupConfigurationStep3(map, popupCfg, featureSet.features, serviceId, layerIdx);
    }.bind(this));
  }

  _applyPopupConfigurationStep3(map, popupCfg, features, serviceId, layerIdx) {
    if (! map || ! popupCfg || ! features || ! features.length) {
      return;
    }

    var geom = features[0].geometry,
        center = null;

    if (popupCfg.anchorPoint) {
      center = new Point(popupCfg.anchorPoint);
    }
    else {
      center = geom.getExtent() ? geom.getExtent().getCenter() : geom;
    }

    if (serviceId) {
      features[0].infoTemplate = map.getLayer(serviceId).infoTemplates[layerIdx].infoTemplate;
      map.infoWindow.setContent(features[0].getContent());
    }
    else {
      map.infoWindow.setFeatures(features);
    }

    map.infoWindow.show(center);

    // Center the map is the geometry isn't visible
    if (! map.extent.contains(center)) {
      map.centerAt(center);
    }
  }
}
