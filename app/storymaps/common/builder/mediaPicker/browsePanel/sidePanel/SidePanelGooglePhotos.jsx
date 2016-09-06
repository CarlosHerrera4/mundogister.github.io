import React from 'react';
import ReactDOM from 'react-dom';
import {} from 'lib-build/less!./SidePanel';
import {} from 'lib-build/less!./SidePanelGooglePhotos';
import i18n from 'lib-build/i18n!../../../../_resources/nls/media';

var text = i18n.mediaPicker.browsePanel.sidePanel.googlePhotos;

class UserSearchAlert extends React.Component {
  render() {
    var style = {
      display: this.props.display ? 'block' : 'none'
    };
    var msg = text.cannotFindUser + ' ' + this.props.triedUser + '. ' + text.tryAgain;

    return (
      <div className="alert alert-danger" role="alert" style={style}>
        <span>{msg}</span>
      </div>
    );
  }
}

class SearchInput extends React.Component {
  componentDidUpdate() {
    if (this.props.setFocus) {
      if (!$(ReactDOM.findDOMNode(this)).parents('.modal').hasClass('in')) {
        setTimeout(() => {
          ReactDOM.findDOMNode(this.refs.textInput).focus();
        }, 500);
      }
      else {
        ReactDOM.findDOMNode(this.refs.textInput).focus();
      }
    }
  }

  render() {
    var parentClass = 'input-group search';
    if (this.props.disabled) {
      parentClass += ' disabled';
    }
    return (
      <div className={parentClass}>
        <div className="input-group-addon">
            <span className={'fa fa-' + this.props.icon} />
        </div>
        <input
          ref="textInput"
          tabIndex="1"
          type="text"
          disabled={this.props.disabled}
          value={this.props.value}
          className="form-control"
          placeholder={this.props.placeholder}
          onChange={this.props.onChange}
          onKeyPress={this.props.onKeyPress} />
        <div
          tabIndex={this.props.disabled ? null : (this.props.value ? '1' : null)}
          className="btn danger input-group-addon"
          style={this.props.value ? null : {display: 'none'}}
          onClick={this.props.value ? (evt) => this.props.onClear(Object.assign({}, evt, {charCode: 13})) : null}
          onKeyPress={this.props.onClear}
          disabled={this.props.disabled} >
          <span className="fa fa-remove" />
        </div>
        <div
          tabIndex={this.props.disabled ? null : '1'}
          className="btn input-group-addon"
          onKeyPress={this.props.onKeyPress}
          // treat click like enter
          onClick={this.props.disabled ? null : (evt) => this.props.onKeyPress(Object.assign({}, evt, {charCode: 13}))}
          disabled={this.props.disabled} >
          <span className={'fa fa-' + (this.props.loading ? 'refresh fa-spin' : 'search')} />
        </div>
      </div>
    );
  }
}

class SidePanelGooglePhotos extends React.Component {

  getHelpSpans() {
    let splitArr = text.helpText.split(/\$\{(.+?)\}/);
    return splitArr.map((str, i) => {
      const reactKey = 'googlehelp-' + i;
      let spanStr = str;
      if (text[str]) {
        spanStr = text[str];
      }
      if (str.indexOf('brand') === 0) {
        return (
          <span key={reactKey}><strong>{spanStr}</strong></span>
        );
      }
      if (str === 'helpLinkText') {
        return (
          <a key={reactKey} href={app.cfg.BUILDER_LINKS.picasaHelp} target="_blank"><strong>{spanStr}</strong></a>
        );
      }
      return (
        <span key={reactKey}>{spanStr}</span>
      );
    });
  }

  render() {
    var msgDisplay = this.props.containerState.userErrorType !== '';

    return (
      <div className="mp-sidepanel">
        <SearchInput
          icon="picture-o"
          placeholder={text.placeholder}
          value={this.props.containerState.searchValue}
          onChange={this.props.onChange}
          onKeyPress={this.props.onKeyPress}
          onClear={this.props.onClear}
        />
        <UserSearchAlert
          display={msgDisplay}
          status={this.props.containerState.userErrorType}
          triedUser={this.props.containerState.searchValue}
        />
        <div className="help-text">
          {this.getHelpSpans()}
        </div>
      </div>
    );
  }
}

export default SidePanelGooglePhotos;
