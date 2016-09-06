define([
  'storymaps-react/tpl/view/section/Immersive/PanelBuilder'
],
function(
  Panel
) {

  var DEFAULT_LAYOUT = 'scroll-full';
  var DEFAULT_SETTINGS = {
    'position-x': 'left',
    size: 'medium',
    style: 'background',
    theme: 'white-over-black'
  };
  var DEFAULT_BLOCKS = [
    {
      type: 'text',
      text: {
        value: '<p class="block"></p>'
      }
    }
  ];

  return {
    createInstance: function(panelJSON, callbacks) {

      if (! panelJSON) {
        var newPanelJSON = {
          'layout': DEFAULT_LAYOUT,
          'settings': DEFAULT_SETTINGS,
          'blocks': DEFAULT_BLOCKS
        };

        return new Panel(newPanelJSON, callbacks);
      }
      else {
        return new Panel(panelJSON, callbacks);
      }
    },
    duplicateWithoutContent: function(panelJSON, callbacks) {
      var newPanelJSON = {};

      if (panelJSON) {
        newPanelJSON = JSON.parse(JSON.stringify(panelJSON));
        newPanelJSON.blocks = DEFAULT_BLOCKS;
      }
      else {
        newPanelJSON = {
          'layout': DEFAULT_LAYOUT,
          'settings': DEFAULT_SETTINGS,
          'blocks': DEFAULT_BLOCKS
        };
      }

      return new Panel(newPanelJSON, callbacks);
    }
  };
});
