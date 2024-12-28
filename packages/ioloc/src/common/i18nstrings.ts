import fs from 'node:fs';

export type I18nStringsEntity = {
  key: string;
  value?: string;
  comments: string[];
};

class I18nStringsFiles {
  readFile(
    file: string,
    options: any,
    callback: (err: Error | null, data: any) => void,
  ) {
    let encoding: string = 'utf8';
    let wantsComments = false;
    if (typeof callback === 'undefined' && typeof options === 'function') {
      callback = options;
      // encoding = null;
    } else if (typeof options === 'string') {
      encoding = options;
    } else if (typeof options === 'object') {
      encoding = options.encoding;
      wantsComments = options.wantsComments;
    }
    fs.readFile(file, (err, buffer) => {
      if (err) {
        return callback ? callback(err, null) : null;
      }
      const str = buffer.toString();
      // const str = this.convertBufferToString(buffer, encoding);
      const data = this.parse(str);
      callback ? callback(null, data) : null;
    });
  }

  readFileSync(file: string, options: any) {
    let encoding = null;
    let wantsComments = false;
    if (typeof options === 'string') {
      encoding = options;
    } else if (typeof options === 'object') {
      encoding = options.encoding;
      wantsComments = options.wantsComments;
    }
    const str = fs.readFileSync(file, encoding).toString();
    return this.parse(str);
  }

  // writeFile(
  //   file: string,
  //   data: any,
  //   options: any,
  //   callback: (err: Error | null) => void,
  // ) {
  //   let encoding = null
  //   let wantsComments = false
  //   if (typeof callback === 'undefined' && typeof options === 'function') {
  //     callback = options
  //     encoding = null
  //   } else if (typeof options === 'string') {
  //     encoding = options
  //   } else if (typeof options === 'object') {
  //     encoding = options.encoding
  //     wantsComments = options.wantsComments
  //   }
  //   const str = this.compile(data, options)
  //   fs.writeFile(file, str, (err) => {
  //     callback ? callback(err) : null
  //   })
  //   // const buffer = this.convertStringToBuffer(str, encoding);
  //   // fs.writeFile(file, buffer, (err) => {
  //   // 	callback ? callback(err) : null;
  //   // });
  // }

  // writeFileSync(file: string, data: any, options: any) {
  //   let encoding = null
  //   let wantsComments = false
  //   if (typeof options === 'string') {
  //     encoding = options
  //   } else if (typeof options === 'object') {
  //     encoding = options.encoding
  //     wantsComments = options.wantsComments
  //   }
  //   const str = this.compile(data, options)
  //   // const buffer = this.convertStringToBuffer(str, encoding);
  //   fs.writeFileSync(file, str)
  // }

  // convertBufferToString(buffer: Buffer, encoding: string) {
  // 	if (!encoding) {
  // 		encoding = "utf16";
  // 	}
  // 	return iconv.decode(buffer, encoding).toString();
  // }

  // convertStringToBuffer(str: string, encoding: string) {
  // 	if (!encoding) {
  // 		encoding = "utf16";
  // 	}
  // 	return iconv.encode(str, encoding);
  // }

  parse(input: string) {
    const reAssign = /[^\\]" = "/;
    const reLineEnd = /";$/;
    const reCommentEnd = /\*\/$/;
    const result: I18nStringsEntity[] = [];
    let currentComment: string | undefined;
    let currentValue = '';
    let currentId = '';
    let nextLineIsComment = false;
    let nextLineIsValue = false;
    const lines = input.split('\n');
    lines.forEach((line) => {
      line = line.trim();
      line = line.replace(/([^\\])("\s*=\s*")/g, '$1" = "');
      line = line.replace(/"\s+;/g, '";');
      if (nextLineIsComment) {
        if (line.search(reCommentEnd) === -1) {
          currentComment += '\n' + line.trim();
          return;
        } else {
          nextLineIsComment = false;
          currentComment +=
            '\n' + line.substring(0, line.search(reCommentEnd)).trim();
          return;
        }
      } else if (line.substring(0, 2) === '/*' && !nextLineIsValue) {
        if (line.search(reCommentEnd) === -1) {
          nextLineIsComment = true;
          currentComment = line.substring(2).trim();
          return;
        } else {
          nextLineIsComment = false;
          currentComment = line
            .substring(2, line.search(reCommentEnd) - 1)
            .trim();
          return;
        }
      }
      let msgid = '';
      let msgstr = '';
      if (line === '' && !nextLineIsValue) {
        return;
      }
      if (nextLineIsValue) {
        if (line.search(reLineEnd) === -1) {
          currentValue += '\n' + line.trim();
          return;
        } else {
          nextLineIsValue = false;
          currentValue +=
            '\n' + line.substring(0, line.search(reLineEnd)).trim();
          msgid = currentId;
          msgstr = currentValue;
          currentId = '';
          currentValue = '';
        }
      } else if (line.search(reLineEnd) === -1 && !nextLineIsComment) {
        nextLineIsValue = true;
        currentId = line;
        currentId = currentId.substring(1);
        currentId = currentId.substring(0, currentId.search(reAssign) + 1);
        currentId = currentId.replace(/\\"/g, '"');
        currentValue = line;
        currentValue = currentValue.substring(
          currentValue.search(reAssign) + 6,
        );
        return;
      } else {
        msgid = line;
        msgid = msgid.substring(1);
        msgid = msgid.substring(0, msgid.search(reAssign) + 1);
        msgstr = line;
        msgstr = msgstr.substring(msgstr.search(reAssign) + 6);
        msgstr = msgstr.substring(0, msgstr.search(reLineEnd));
      }
      msgid = msgid.replace(/\\"/g, '"');
      msgid = msgid.replace(/\\n/g, '\n');
      msgstr = msgstr.replace(/\\"/g, '"');
      msgstr = msgstr.replace(/\\n/g, '\n');
      if (currentComment) {
        result.push({
          key: msgid,
          value: msgstr,
          comments: [currentComment],
        });
      } else {
        result.push({
          key: msgid,
          value: msgstr,
          comments: [],
        });
      }
    });
    return result;
  }

  compile(data: I18nStringsEntity[]): string {
    let entries: string[] = [];
    for (const val of data) {
      let msgstr = val.value || '';
      let msgid = val.key;
      msgid = msgid.replace(/"/g, '\\"');
      msgstr = msgstr.replace(/"/g, '\\"');
      // msgid = msgid.replace(/\n/g, '\\n')
      // msgstr = msgstr.replace(/\r?\n/g, '\\n')
      let entry = '';
      for (const comment of val.comments) {
        entry += '/* ' + comment.replaceAll(/\n/g, '\n   ') + ' */\n';
      }
      entry += '"' + msgid + '" = "' + msgstr + '";\n';
      entries.push(entry);
    }
    return entries.join('\n');
  }

  // compile(data: any, wantsComments: boolean) {
  //   if (!wantsComments) {
  //     wantsComments = false
  //   }
  //   if (typeof data !== 'object') {
  //     return ''
  //   }
  //   let output = ''
  //   for (var msgid in data) {
  //     if (data.hasOwnProperty(msgid)) {
  //       let msgstr = ''
  //       let comment = null
  //       const val = data[msgid]
  //       if (typeof val === 'string') {
  //         msgstr = val
  //       } else {
  //         if (val.hasOwnProperty('text')) {
  //           msgstr = val.text
  //         }
  //         if (wantsComments && val.hasOwnProperty('comment')) {
  //           comment = val.comment
  //         }
  //       }
  //       msgid = msgid.replace(/"/g, '\\"')
  //       msgstr = msgstr.replace(/"/g, '\\"')
  //       msgid = msgid.replace(/\n/g, '\\n')
  //       msgstr = msgstr.replace(/\r?\n/g, '\\n')
  //       if (comment) {
  //         output += '/* ' + comment + ' */\n'
  //       }
  //       output += '"' + msgid + '" = "' + msgstr + '";\n'
  //     }
  //   }
  //   return output
  // }
}

const i18nStringsFiles = new I18nStringsFiles();

export default i18nStringsFiles;
