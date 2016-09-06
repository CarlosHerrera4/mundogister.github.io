import {} from 'lib-build/less!./ImmersiveBuilderPanel';
import OverviewPanel from 'storymaps-react/tpl/builder/overviewPanel/OverviewPanel';

const TRANSITIONS = {
  'fade-fast': {
    id: 'fade-fast',
    label: 'Fade',
    icon: 'resources/tpl/builder/icons/immersive-panel/FadeFast.png'
  },
  'fade-slow': {
    id: 'fade-slow',
    label: 'Fade slow',
    icon: 'resources/tpl/builder/icons/immersive-panel/Fade.png'
  },
  'swipe-vertical': {
    id: 'swipe-vertical',
    label: 'Swipe Vertical',
    icon: 'resources/tpl/builder/icons/immersive-panel/SwipeVertical.png'
  },
  'swipe-horizontal': {
    id: 'swipe-horizontal',
    label: 'Swipe Horizontal',
    icon: 'resources/tpl/builder/icons/immersive-panel/SwipeHorizontal.png'
  },
  none: {
    id: 'none',
    label: 'None',
    icon: 'resources/tpl/builder/icons/immersive-panel/None.png'
  }
};

export default class ImmersiveBuilderPanel {
  constructor(params) {
    params = params || {};

    if (! params.container) {
      return;
    }

    // The whole section
    this._node = params.container;

    this._medias = null;
    this._panels = null;
    this._transitions = null;

    this._overview = new OverviewPanel(
      this._node[0],
      'horizontal',
      [],
      {
        selectItem: function(id) {
          params.selectView(this._getViewById(id));
        }.bind(this),
        addItem: params.addView,
        deleteItem: function(id) {
          params.deleteView(this._getViewById(id));
        }.bind(this),
        duplicateItem: function(id) {
          params.duplicateView(this._getViewById(id));
        }.bind(this),
        updateItemTransition: params.updateTransition,
        organize: params.organize
      }
    );
  }

  update(data) {
    data = data || {};

    if (! data.medias || ! data.panels) {
      return;
    }

    this._medias = data.medias;
    this._panels = data.panels;
    this._transitions = data.transitions;

    this._overview.updateItems(this._getViewsOverview(data.transitionsInfos));
  }

  selectView(index) {
    if (index < 0) {
      return;
    }

    this._overview.navigateTo(this._getViewIdByIndex(index));
  }

  //
  // Internal
  //

  _getViewById(id) {
    for (var panelIndex in this._panels) {
      var panel = this._panels[panelIndex];

      if (panel.id == id) {
        return parseInt(panelIndex, 10);
      }
    }

    return -1;
  }

  _getViewIdByIndex(index) {
    if (index < 0) {
      return null;
    }

    return this._panels[index].id;
  }

  /*
   * Is the media at index a duplicate
   * i.e: is there the same media in a previous view
   */
  /*
  _isDuplicate(media, index, medias) {
    if (! index || ! medias) {
      return false;
    }

    return medias.slice(0, index).indexOf(media) > - 1;
  }
  */

  _getViewsOverview(transitionsInfos) {
    var overview = [];

    for(let i = 0; i < this._medias.length; i++) {
      let media = this._medias[i],
          panel = this._panels[i],
          transition = this._transitions[i],
          transitionInfo = transitionsInfos[i];

      overview.push({
        id: panel.id,
        type: 'thumbnail',
        icon: media.getPreviewIcon(),
        transition: transition,
        transitions: this._getTransition({
          index: i,
          mediaType: media.type,
          isDuplicate: transitionInfo.isDuplicate,
          isDuplicateConsecutive: transitionInfo.isDuplicateConsecutive,
          firstOccurenceTransition: transitionInfo.firstOccurenceTransition,
          duplicateConsecutiveTransitions: transitionInfo.duplicateConsecutiveTransitions
        }),
        thumbnail: media.getPreviewThumbnail(),
        hidden: false,
        hasDelete: true,
        hasHide: true,
        hasDuplicate: true,
        hasOrganize: true
      });
    }

    return overview;
  }

  _getTransition(config = {}) {
    let transitions = [];

    if (config.index === 0) {
      return transitions;
    }

    // Two views using the same media consecutivly
    // -> disable all options except if the transition is listed in config.duplicateConsecutiveTransitions
    //    This is currently for webmap to allow swipe depending on the two medias config
    if (config.isDuplicateConsecutive) {
      let disabledTooltip = 'Not available when consecutive views use the same media',
          disabledTooltipMap = 'To use this transition the visible layers in both views must be different and the other map properties must be the same',
          disabledTooltipMapTmp = 'Not available when consecutive views use the same map',
          disabledTooltipMapTmp2 = 'Not available in beta',
          disabledTransitions = ['fade-fast', 'fade-slow', 'swipe-vertical', 'swipe-horizontal'];

      for (let name of disabledTransitions) {
        let transition = Object.assign({}, TRANSITIONS[name]);

        if (config.duplicateConsecutiveTransitions.indexOf(name) > -1) {
          transition.enabled = true;
          transition.tooltip = '';
        }
        else if (config.mediaType == 'webmap') {
          // TODO: will remove that limitation soon
          if (name == 'fade-slow' || name == 'fade-fast') {
            transition.enabled = false;
            transition.tooltip = disabledTooltipMapTmp;
          }
          else if (name == 'swipe-horizontal') {
            transition.enabled = false;
            transition.tooltip = disabledTooltipMapTmp2;
          }
          else {
            transition.enabled = false;
            transition.tooltip = disabledTooltipMap;
          }
        }
        else {
          transition.enabled = false;
          transition.tooltip = disabledTooltip;
        }

        transitions.push(transition);
      }

      // "None" is the only available option
      let transition = Object.assign({}, TRANSITIONS['none']);
      transition.enabled = true;
      transition.tooltip = '';
      transitions.push(transition);
    }
    // Duplicate and non consecutive section
    // Only the transition from the first occurence of the media is authorized
    else if (config.isDuplicate && config.firstOccurenceTransition) {
      //let disabledTooltip = 'Not available as the first occurence is using a different transition';

      // Temporary workaround
      let disabledTooltip = 'Not available as there is another occurence of this media that is non consecutive';
      config.firstOccurenceTransition = 'none';

      for (let name in TRANSITIONS) {
        let transition = Object.assign({}, TRANSITIONS[name]);

        if (name != config.firstOccurenceTransition) {
          transition.enabled = false;
          transition.tooltip = disabledTooltip;
        }
        else {
          transition.enabled = true;
          transition.tooltip = '';
        }

        transitions.push(transition);
      }
    }
    // Allow all transitions
    else {
      for (let name in TRANSITIONS) {
        let transition = Object.assign({}, TRANSITIONS[name]);

        transition.enabled = true;
        transition.tooltip = '';

        transitions.push(transition);
      }
    }

    return transitions;
  }
}
