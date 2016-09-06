import viewTpl from 'lib-build/hbars!./BuilderPanel';
import {} from 'lib-build/less!./BuilderPanel';

import OverviewPanel from '../overviewPanel/OverviewPanel';
import topic from 'dojo/topic';

export default class BuilderPanel {
  constructor(params = {}) {
    this._node = params.container;
    this._saveApp = params.saveApp;
    this._shareApp = params.shareApp;
    this._saveFailed = false;

    if (! this._node || ! this._saveApp || ! this._shareApp) {
      console.error('Could not initialize Builder Panel');
      return;
    }

    this._node.html(viewTpl({
      btnSave: i18n.viewer.common.save
    }));

    this._overviewPanel = null;

    // Initialize the inner share button tooltip before the outer. Then manually show and hide the outer tooltip when the inner one shows and hides.
    // That way both show at first
    this._node.find('.btn-share-container .btn-share-wrapper').tooltip({
      container: '.section-builder-panel',
      placement: 'top'
    });

    this._node.find('.btn-share-container .btn-share-wrapper').on('inserted.bs.tooltip', function() {
      // this class is so we don't have the min-width of 200px for these buttons...
      $(this).data('bs.tooltip').$tip.addClass('share-tooltip');
    });

    this._node.find('.btn-share-container .btn-share-wrapper').on('show.bs.tooltip', function() {
      $(this).closest('.btn-share-outer-tooltip.tooltip-enabled').tooltip('show');
    });

    this._node.find('.btn-share-container .btn-share-wrapper').on('hide.bs.tooltip', function() {
      $(this).closest('.btn-share-outer-tooltip.tooltip-enabled').tooltip('hide');
    });

    this._node.find('.btn-share-outer-tooltip.tooltip-enabled').tooltip({
      placement: 'bottom',
      container: '.section-builder-panel',
      trigger: 'manual'
    });

    this._node.find('.btn-share-outer-tooltip.tooltip-enabled').on('inserted.bs.tooltip', function() {
      // this class is so we don't have the min-width of 200px for these buttons...
      $(this).data('bs.tooltip').$tip.addClass('custom-warning');
    });

    this._initEvents();
  }

  _initEvents() {
    topic.subscribe('tpl-ready', this._onStoryReady.bind(this));
    topic.subscribe('builder-section-update', this._updateOverview.bind(this));
    topic.subscribe('story-navigated-section', this._onSectionNavigate.bind(this));
    topic.subscribe('builder-story-title-update', this._updateStoryTitle.bind(this));
    topic.subscribe('builder-story-update', this._updateSaveButtonStatus.bind(this));

    this._node.find('.btn-settings').click(this._onSettings.bind(this));
    this._node.find('.btn-preview').click(this._onPreview.bind(this));
    this._node.find('.btn-save').click(this._onSave.bind(this));

    this._node.find('.beta-tooltip').tooltip({
      title: 'Story Map Cascade is in beta. Please let us know what you think or if something is not working as you expected.',
      placement: 'bottom',
      container: '.section-builder-panel'
    });
  }

  _onStoryReady() {
    this._initShareButtons();
    this._updateShareButtons();
    this._updatePreviewButton();
    this._updateOverview();
  }

  //
  // Reflect story title
  //

  _updateStoryTitle() {
    var buttons = this._node.find('.builder-buttons .btn'),
        buttonsExceptSave = this._node.find('.builder-buttons .btn:not(.btn-save)'),
        storyTitle = app.Controller.getStoryTitle();

    buttons.toggleClass('disabled', ! storyTitle);

    if (! storyTitle) {
      buttons.tooltip({
        title: 'Add a title for your story on the cover to save',
        placement: 'right',
        container: '.section-builder-panel'
      });
    }
    else {
      // if we're in a "save failed" mode, we don't want to blow away the tooltip that says that on the save button... otherwise we blow away its tooltip
      if (this._saveFailed) {
        buttonsExceptSave.tooltip('destroy');
      }
      else {
        buttons.tooltip('destroy');
      }
    }

    this._updatePreviewButton();
  }

  //
  // Settings
  //

  _onSettings(e) {
    if ($(e.currentTarget).hasClass('disabled')) {
      return;
    }

    app.Controller.openSettings();
  }

  //
  // Share
  //

  _initShareButtons() {
    //
    // Find which share buttons to active
    //
    var isOrg = app.portal.isOrganization !== false,
        privileges = app.portal.getPortalUser().privileges || [],
        sharingLevel = app.data.appItem.item.access,
        itemControl = app.data.appItem.item.itemControl,
        enableOrg = isOrg && privileges.indexOf('portal:user:shareToOrg') > -1,
        enablePub = ! isOrg ||  privileges.indexOf('portal:user:shareToPublic') > -1,
        storyIsPrivate = sharingLevel == 'private' || sharingLevel == 'shared',
        storyIsOrg = sharingLevel == 'account',
        userIsOwner = app.data.appItem.item.owner == app.portal.getPortalUser().username;

    // TODO: to review with 4.2
    // Group with shared ownership and custom role with admin:update
    if (itemControl == 'update') {
      enableOrg = false;
      enablePub = false;
    }
    // TODO checking if the privilege is here directly would be enough if builder was not opening if user don't have proper update priv (only admin view all)
    else if (itemControl == 'admin' && ! userIsOwner) {
      enableOrg = privileges.indexOf('portal:admin:shareToOrg') > -1;
      enablePub = privileges.indexOf('portal:admin:shareToPublic') > -1;
    }

    // TODO: in some case the button may need to be disabled
    if (storyIsOrg) {
      enableOrg = true;
    }
    else if (! storyIsPrivate) {
      enablePub = true;
    }

    // TODO: tooltip when org has disabled sharing
    this._node.find('.btn-share-outer-tooltip[data-level="account"]').toggle(enableOrg);
    this._node.find('.btn-share-outer-tooltip[data-level="public"]').toggle(enablePub);

    this._node.find('.btn-share-wrapper').click(this._onChangeSharing.bind(this));
  }

  _onChangeSharing(e) {
    var sharingBtn = $(e.currentTarget);

    this._node.find('.btn-share-this._node').addClass('disabled');
    this._node.find('.btn-share-wrapper').removeClass('active');

    sharingBtn.addClass('sharing');

    this._shareApp({
      sharingLevel: sharingBtn.data('level')
    }).then(
      function() {
        this._updateShareButtons();
        this._updatePreviewButton();

        // Update status of Share dialog > sharing buttons
        app.Controller.renderHeader();
      }.bind(this),
      function() {
        //
      }
    );
  }

  _updateShareButtons() {
    var sharingLevel = 'private';

    this._node.find('.btn-share-wrapper').removeClass('sharing');

    if (app.data.appItem.item && app.data.appItem.item.access && app.Controller.getStoryTitle()) {
      sharingLevel = app.data.appItem.item.access;

      this._node.find('.btn-share-container').removeClass('disabled');
      this._node.find('.btn-share-wrapper[data-level=' + sharingLevel + ']').addClass('active');
    }
    else {
      this._node.find('.btn-share-container').addClass('disabled');
    }
  }

  //
  // Preview
  //

  _updatePreviewButton() {
    var sharingLevel = app.data.appItem.item.access,
        isCreated = !! app.data.appItem.item.id,
        isShared = sharingLevel == 'account' || sharingLevel == 'public',
        previewBtn = this._node.find('.btn-preview');

    previewBtn.toggleClass('disabled', ! isCreated);

    if (! isShared) {
      previewBtn.tooltip({
        title: 'Your story isn\'t shared, only you can see it',
        placement: 'right',
        container: '.section-builder-panel'
      });
    }
    else {
      previewBtn.tooltip('destroy');
    }
  }

  _onPreview(e) {
    if ($(e.currentTarget).hasClass('disabled')) {
      return;
    }

    window.open(
      app.Controller.getStoryURL(),
      '_blank'
    );
  }

  //
  // Save
  //

  _updateSaveButtonStatus() {
    var saveBtn = this._node.find('.btn-save'),
        title = app.Controller.getStoryTitle();

    saveBtn.toggleClass('btn-primary', !! (title && app.builder.pendingChanges));
  }

  _onSave(e) {
    var btn = $(e.currentTarget);

    if (btn.hasClass('disabled')) {
      return;
    }

    btn
      .removeClass('saved')
      .addClass('saving disabled');

    btn.find('.btn-save-label').html(i18n.commonCore.builderPanel.buttonSaving);

    this._saveApp();
  }

  saveSucceeded() {
    this._saveFailed = false;

    this._node.find('.btn-save')
      .removeClass('saving disabled')
      .addClass('saved');
    this._node.find('.btn-save-label').html(i18n.commonCore.builderPanel.buttonSaved);

    this._node.find('.btn-save[data-toggle="tooltip"]').tooltip('destroy');

    setTimeout(() => {
      this._node.find('.btn-save')
        .removeClass('saved')
        .find('.btn-save-label').html(i18n.viewer.common.save);
    }, 3500);

    this._updateSaveButtonStatus();
    this._updateShareButtons();
    this._updatePreviewButton();
  }

  saveFailed() {
    this._saveFailed = true;

    this._node.find('.btn-save')
      .removeClass('saving')
      .addClass('error');
    this._node.find('.btn-save-label').html(i18n.commonCore.builderPanel.buttonError);

    this._node.find('.btn-save[data-toggle="tooltip"]').tooltip({
      trigger: 'manual',
      placement: 'right',
      container: '.builder-buttons'
    });

    this._node.find('.btn-save[data-toggle="tooltip"]').on('inserted.bs.tooltip', function() {
      // selectively style only this tooltip by giving it a class
      $(this).data('bs.tooltip').$tip.addClass('custom-error');
    });
    this._node.find('.btn-save[data-toggle="tooltip"]').tooltip('show');

    setTimeout(() => {
      this._node.find('.btn-save')
        .removeClass('error disabled')
        .find('.btn-save-label').html(i18n.viewer.common.save);
    }, 3500);
  }

  //
  // Overview
  //

  _updateOverview() {
    var storyOverview = app.Controller.getStoryOverview();

    if (! this._overviewPanel) {
      this._initOverviewPanel(storyOverview);
    }
    else {
      this._overviewPanel.updateItems(storyOverview);
    }
  }

  _onSectionNavigate(data) {
    if (this._overviewPanel) {
      this._overviewPanel.navigateTo(
        app.Controller.getSectionIndexById(data.index)
      );
    }
  }

  _initOverviewPanel(storyOverview) {
    this._overviewPanel = new OverviewPanel(this._node.find('.overview')[0], 'vertical', storyOverview, {
      selectItem: function(sectionId) {
        var sectionIndex = app.Controller.getSectionById(sectionId);
        console.log('selectItem:', sectionIndex);
        app.Controller.navigateToSection({
          index: sectionIndex,
          animate: false
        });
      },

      duplicateItem: function(sectionId) {
        var sectionIndex = app.Controller.getSectionById(sectionId);
        console.log('duplicateItem:', sectionIndex);

        app.Controller.duplicateSection({
          index: sectionIndex
        });
      },
      toggleHidden: function(sectionId) {
        var sectionIndex = app.Controller.getSectionById(sectionId);
        console.log('toggleHidden:', sectionIndex);
        console.log('TODO NOT IMPLEMENTED');
      },
      deleteItem: function(sectionId) {
        var sectionIndex = app.Controller.getSectionById(sectionId);
        console.log('deleteItem:', sectionIndex);
        app.Controller.deleteSection({
          index: sectionIndex
        });
      },

      organize: function(sectionsIds) {
        var sectionsIndexes = app.Controller.getSectionsIndexesByIds(sectionsIds);
        console.log('organize:', sectionsIds, sectionsIndexes);

        app.Controller.organizeSections(sectionsIndexes);
      }
    });
  }
}
