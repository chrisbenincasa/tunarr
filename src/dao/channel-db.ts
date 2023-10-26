import fs from 'fs';
import { isUndefined } from 'lodash';
import path from 'path';

export class ChannelDB {
  private folder: string;

  constructor(folder: string) {
    this.folder = folder;
  }

  async getChannel(number) {
    let f = path.join(this.folder, `${number}.json`);
    try {
      return await new Promise((resolve, reject) => {
        fs.readFile(f, (err, data) => {
          if (err) {
            return reject(err);
          }
          try {
            resolve(JSON.parse(data.toString('utf-8')));
          } catch (err) {
            reject(err);
          }
        });
      });
    } catch (err) {
      console.error(err);
      return null;
    }
  }

  async saveChannel(number, json) {
    this.validateChannelJson(number, json);
    let f = path.join(this.folder, `${json.number}.json`);
    return await new Promise((resolve, reject) => {
      let data = undefined;
      try {
        data = JSON.stringify(json);
      } catch (err) {
        return reject(err);
      }
      fs.writeFile(f, data, (err) => {
        if (err) {
          return reject(err);
        }
        resolve(void 0);
      });
    });
  }

  saveChannelSync(number, json) {
    this.validateChannelJson(number, json);

    let data = JSON.stringify(json);
    let f = path.join(this.folder, `${json.number}.json`);
    fs.writeFileSync(f, data);
  }

  validateChannelJson(number, json) {
    json.number = number;
    if (isUndefined(json.number)) {
      throw Error('Expected a channel.number');
    }
    if (typeof json.number === 'string') {
      try {
        json.number = parseInt(json.number);
      } catch (err) {
        console.error('Error parsing channel number.', err);
      }
    }
    if (isNaN(json.number)) {
      throw Error('channel.number must be a integer');
    }
  }

  async deleteChannel(number) {
    let f = path.join(this.folder, `${number}.json`);
    await new Promise((resolve, reject) => {
      fs.unlink(f, function (err) {
        if (err) {
          return reject(err);
        }
        resolve(void 0);
      });
    });
  }

  async getAllChannelNumbers(): Promise<any[]> {
    return await new Promise((resolve, reject) => {
      fs.readdir(this.folder, function (err, items) {
        if (err) {
          return reject(err);
        }
        let channelNumbers = [];
        for (let i = 0; i < items.length; i++) {
          let name = path.basename(items[i]);
          if (path.extname(name) === '.json') {
            let numberStr = name.slice(0, -5);
            if (!isNaN(parseInt(numberStr))) {
              channelNumbers.push(parseInt(numberStr));
            }
          }
        }
        resolve(channelNumbers);
      });
    });
  }

  async getAllChannels(): Promise<any[]> {
    let numbers = await this.getAllChannelNumbers();
    return await Promise.all(numbers.map(async (c) => this.getChannel(c)));
  }
}
