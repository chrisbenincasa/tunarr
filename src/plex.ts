import request from 'request';
import { isUndefined } from 'lodash-es';
import { PlexServerSettings } from './dao/db.js';
export class Plex {
  private _accessToken: string;
  private _server: any;
  private _headers: object;

  constructor(opts: Partial<PlexServerSettings>) {
    this._accessToken =
      typeof opts.accessToken !== 'undefined' ? opts.accessToken : '';
    let uri = 'http://127.0.0.1:32400';
    if (typeof opts.uri !== 'undefined') {
      uri = opts.uri;
      if (uri.endsWith('/')) {
        uri = uri.slice(0, uri.length - 1);
      }
    }
    this._server = {
      uri: uri,
    };
    this._headers = {
      Accept: 'application/json',
      'X-Plex-Device': 'dizqueTV',
      'X-Plex-Device-Name': 'dizqueTV',
      'X-Plex-Product': 'dizqueTV',
      'X-Plex-Version': '0.1',
      'X-Plex-Client-Identifier': 'rg14zekk3pa5zp4safjwaa8z',
      'X-Plex-Platform': 'Chrome',
      'X-Plex-Platform-Version': '80.0',
    };
  }

  get URL() {
    return `${this._server.uri}`;
  }

  SignIn(username, password) {
    return new Promise((resolve, reject) => {
      if (isUndefined(username === 'undefined' || typeof password))
        reject(
          "Plex 'SignIn' Error - No Username or Password was provided to sign in.",
        );
      var req = {
        method: 'post',
        url: 'https://plex.tv/users/sign_in.json',
        headers: this._headers,
        form: {
          user: {
            login: username,
            password: password,
          },
        },
        jar: false,
      };
      request(req, (err, res, body) => {
        if (err || res.statusCode !== 201)
          reject(
            "Plex 'SignIn' Error - Username/Email and Password is incorrect!.",
          );
        else {
          this._accessToken = JSON.parse(body).user.authToken;
          resolve({ accessToken: this._accessToken });
        }
      });
    });
  }

  doRequest(req): Promise<any> {
    return new Promise((resolve, reject) => {
      request(req, (err, res) => {
        if (err) {
          reject(err);
        } else if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(Error(`Request returned status code ${res.statusCode}`));
        } else {
          resolve(res);
        }
      });
    });
  }

  async Get(path, optionalHeaders = {}) {
    console.log(path);
    let req = {
      method: 'get',
      url: `${this.URL}${path}`,
      headers: this._headers,
      jar: false,
    };
    Object.assign(req, optionalHeaders);
    req.headers['X-Plex-Token'] = this._accessToken;
    if (this._accessToken === '') {
      throw Error(
        'No Plex token provided. Please use the SignIn method or provide a X-Plex-Token in the Plex constructor.',
      );
    } else {
      let res = await this.doRequest(req);
      return JSON.parse(res.body).MediaContainer;
    }
  }
  async Put(path, query = {}, optionalHeaders = {}) {
    var req = {
      method: 'put',
      url: `${this.URL}${path}`,
      headers: this._headers,
      qs: query,
      jar: false,
    };
    Object.assign(req, optionalHeaders);
    req.headers['X-Plex-Token'] = this._accessToken;
    await new Promise((resolve, reject) => {
      if (this._accessToken === '')
        reject(
          'No Plex token provided. Please use the SignIn method or provide a X-Plex-Token in the Plex constructor.',
        );
      else
        request(req, (err, res) => {
          if (err || res.statusCode !== 200)
            reject(`Plex 'Put' request failed. URL: ${this.URL}${path}`);
          else resolve(res.body);
        });
    });
  }
  Post(path, query = {}, optionalHeaders = {}) {
    var req = {
      method: 'post',
      url: `${this.URL}${path}`,
      headers: this._headers,
      qs: query,
      jar: false,
    };
    Object.assign(req, optionalHeaders);
    req.headers['X-Plex-Token'] = this._accessToken;
    return new Promise((resolve, reject) => {
      if (this._accessToken === '')
        reject(
          'No Plex token provided. Please use the SignIn method or provide a X-Plex-Token in the Plex constructor.',
        );
      else
        request(req, (err, res) => {
          if (err || res.statusCode !== 200)
            reject(`Plex 'Post' request failed. URL: ${this.URL}${path}`);
          else resolve(res.body);
        });
    });
  }
  async checkServerStatus() {
    try {
      await this.Get('/');
      return 1;
    } catch (err) {
      console.error('Error getting Plex server status', err);
      return -1;
    }
  }
  async GetDVRS() {
    try {
      var result = await this.Get('/livetv/dvrs');
      var dvrs = result.Dvr;
      dvrs = isUndefined(dvrs) ? [] : dvrs;
      return dvrs;
    } catch (err) {
      throw Error('GET /livetv/drs failed: ' + err.message);
    }
  }
  async RefreshGuide(_dvrs) {
    try {
      var dvrs = typeof _dvrs !== 'undefined' ? _dvrs : await this.GetDVRS();
      for (var i = 0; i < dvrs.length; i++) {
        await this.Post(`/livetv/dvrs/${dvrs[i].key}/reloadGuide`);
      }
    } catch (err) {
      throw Error('Zort', err);
    }
  }
  async RefreshChannels(channels, _dvrs) {
    var dvrs = typeof _dvrs !== 'undefined' ? _dvrs : await this.GetDVRS();
    var _channels: any[] = [];
    let qs: Record<string, string> = {};
    for (var i = 0; i < channels.length; i++) {
      _channels.push(channels[i].number);
    }
    qs.channelsEnabled = _channels.join(',');
    for (var i = 0; i < _channels.length; i++) {
      qs[`channelMapping[${_channels[i]}]`] = _channels[i];
      qs[`channelMappingByKey[${_channels[i]}]`] = _channels[i];
    }
    for (var i = 0; i < dvrs.length; i++) {
      for (var y = 0; y < dvrs[i].Device.length; y++) {
        await this.Put(
          `/media/grabbers/devices/${dvrs[i].Device[y].key}/channelmap`,
          qs,
        );
      }
    }
  }
}
