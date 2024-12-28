/**
 * Parser for .strings files.
 *
 * You can use this class directly, but it is recommended to use
 * `File.parse` and `File.parse_file` wrappers instead.
 */
export class DotStringsParser {
  // Special tokens
  static TOK_SLASH: string = '/';
  static TOK_ASTERISK: string = '*';
  static TOK_QUOTE: string = '"';
  static TOK_SINGLE_QUOTE: string = "'";
  static TOK_BACKSLASH: string = '\\';
  static TOK_EQUALS: string = '=';
  static TOK_SEMICOLON: string = ';';
  static TOK_NEW_LINE: string = '\n';
  static TOK_N: string = 'n';
  static TOK_R: string = 'r';
  static TOK_T: string = 't';
  static TOK_CAP_U: string = 'U';
  static TOK_ZERO: string = '0';
  static TOK_HEX_DIGIT: RegExp = /[0-9a-fA-F]/;

  // States
  static STATE_START: number = 0;
  static STATE_COMMENT_START: number = 1;
  static STATE_COMMENT: number = 2;
  static STATE_MULTILINE_COMMENT: number = 3;
  static STATE_COMMENT_END: number = 4;
  static STATE_KEY: number = 5;
  static STATE_KEY_END: number = 6;
  static STATE_VALUE_SEPARATOR: number = 7;
  static STATE_VALUE: number = 8;
  static STATE_VALUE_END: number = 9;
  static STATE_UNICODE: number = 10;
  static STATE_UNICODE_SURROGATE: number = 11;
  static STATE_UNICODE_SURROGATE_U: number = 12;

  private strict: boolean;
  private state: number;
  private tempState: number | null;
  private buffer: string[];
  private unicodeBuffer: string[];
  private highSurrogate: number | null;
  private escaping: boolean;
  private currentComment: string | null;
  private currentKey: string | null;
  private currentValue: string | null;
  private itemBlock: ((item: DotStringsItem) => void) | null;
  private offset: number;
  private line: number;
  private column: number;

  /**
   * Returns a new Parser instance.
   *
   * @param strict Whether to parse in strict mode.
   */
  constructor(strict: boolean = true) {
    this.strict = strict;

    this.state = DotStringsParser.STATE_START;
    this.tempState = null;

    this.buffer = [];
    this.unicodeBuffer = [];
    this.highSurrogate = null;

    this.escaping = false;

    this.currentComment = null;
    this.currentKey = null;
    this.currentValue = null;

    this.itemBlock = null;

    this.offset = 0;
    this.line = 1;
    this.column = 1;
  }

  /**
   * Specifies a block to be called when a new item is parsed.
   */
  onItem(block: (item: DotStringsItem) => void): void {
    this.itemBlock = block;
  }

  // rubocop:disable Metrics/CyclomaticComplexity, Metrics/PerceivedComplexity, Metrics/BlockLength

  /**
   * Feeds data to the parser.
   */
  public feed(data: string): void {
    for (const ch of data) {
      switch (this.state) {
        case DotStringsParser.STATE_START:
          this.startValue(ch);
          break;
        case DotStringsParser.STATE_COMMENT_START:
          switch (ch) {
            case DotStringsParser.TOK_SLASH:
              this.state = DotStringsParser.STATE_COMMENT;
              break;
            case DotStringsParser.TOK_ASTERISK:
              this.state = DotStringsParser.STATE_MULTILINE_COMMENT;
              break;
            default:
              this.raiseError(`Unexpected character '${ch}'`);
          }
          break;
        case DotStringsParser.STATE_COMMENT:
          if (ch === DotStringsParser.TOK_NEW_LINE) {
            this.state = DotStringsParser.STATE_COMMENT_END;
            this.currentComment = this.buffer.join('').trim();
            this.buffer.length = 0;
          } else {
            this.buffer.push(ch);
          }
          break;
        case DotStringsParser.STATE_MULTILINE_COMMENT:
          if (
            ch === DotStringsParser.TOK_SLASH &&
            this.buffer[this.buffer.length - 1] ===
              DotStringsParser.TOK_ASTERISK
          ) {
            this.state = DotStringsParser.STATE_COMMENT_END;
            this.currentComment = this.buffer
              .slice(0, this.buffer.length - 1)
              .join('')
              .trim();
            this.buffer.length = 0;
          } else {
            this.buffer.push(ch);
          }
          break;
        case DotStringsParser.STATE_COMMENT_END:
          this.commentEnd(ch);
          break;
        case DotStringsParser.STATE_KEY:
          this.parseString(ch, (key) => {
            this.currentKey = key;
            this.state = DotStringsParser.STATE_KEY_END;
          });
          break;
        case DotStringsParser.STATE_KEY_END:
          if (ch === DotStringsParser.TOK_EQUALS) {
            this.state = DotStringsParser.STATE_VALUE_SEPARATOR;
          } else {
            if (!this.whitespace(ch)) {
              this.raiseError(
                `Unexpected character '${ch}', expecting '${DotStringsParser.TOK_EQUALS}'`,
              );
            }
          }
          break;
        case DotStringsParser.STATE_VALUE_SEPARATOR:
          if (ch === DotStringsParser.TOK_QUOTE) {
            this.state = DotStringsParser.STATE_VALUE;
          } else {
            if (!this.whitespace(ch)) {
              this.raiseError(`Unexpected character '${ch}'`);
            }
          }
          break;
        case DotStringsParser.STATE_VALUE:
          this.parseString(ch, (value) => {
            this.currentValue = value;
            this.state = DotStringsParser.STATE_VALUE_END;

            this.itemBlock?.call(
              this,
              new DotStringsItem(
                this.currentComment,
                this.currentKey,
                this.currentValue,
              ),
            );
          });
          break;
        case DotStringsParser.STATE_VALUE_END:
          if (ch === DotStringsParser.TOK_SEMICOLON) {
            this.state = DotStringsParser.STATE_START;
          } else {
            if (!this.whitespace(ch)) {
              this.raiseError(
                `Unexpected character '${ch}', expecting '${DotStringsParser.TOK_SEMICOLON}'`,
              );
            }
          }
          break;
        case DotStringsParser.STATE_UNICODE:
          this.parseUnicode(ch, (unicodeCh) => {
            this.buffer.push(unicodeCh);
            // Restore state
            this.state = this.tempState!;
          });
          break;
        case DotStringsParser.STATE_UNICODE_SURROGATE:
          if (ch === DotStringsParser.TOK_BACKSLASH) {
            this.state = DotStringsParser.STATE_UNICODE_SURROGATE_U;
          } else {
            this.raiseError(
              `Unexpected character '${ch}', expecting another unicode codepoint`,
            );
          }
          break;
        case DotStringsParser.STATE_UNICODE_SURROGATE_U:
          if (ch === DotStringsParser.TOK_CAP_U) {
            this.state = DotStringsParser.STATE_UNICODE;
          } else {
            this.raiseError(
              `Unexpected character '${ch}', expecting '${DotStringsParser.TOK_CAP_U}'`,
            );
          }
          break;
      }

      this.updatePosition(ch);
    }
  }

  // rubocop:enable Metrics/CyclomaticComplexity, Metrics/PerceivedCompl
  private raiseError(message: string): never {
    throw new Error(
      `${message} at line ${this.line}, column ${this.column} (offset: ${this.offset})`,
    );
  }

  private parseString(ch: string, callback: (value: string) => void): void {
    if (this.escaping) {
      this.parseEscapedCharacter(ch);
    } else {
      switch (ch) {
        case DotStringsParser.TOK_BACKSLASH:
          this.escaping = true;
          break;
        case DotStringsParser.TOK_QUOTE:
          callback(this.buffer.join(''));
          this.buffer.length = 0;
          break;
        default:
          this.buffer.push(ch);
      }
    }
  }

  // rubocop:disable Metrics/CyclomaticComplexity

  private parseEscapedCharacter(ch: string): void {
    this.escaping = false;

    switch (ch) {
      case DotStringsParser.TOK_QUOTE:
      case DotStringsParser.TOK_SINGLE_QUOTE:
      case DotStringsParser.TOK_BACKSLASH:
        this.buffer.push(ch);
        break;
      case DotStringsParser.TOK_N:
        this.buffer.push('\n');
        break;
      case DotStringsParser.TOK_R:
        this.buffer.push('\r');
        break;
      case DotStringsParser.TOK_T:
        this.buffer.push('\t');
        break;
      case DotStringsParser.TOK_CAP_U:
        this.tempState = this.state;
        this.state = DotStringsParser.STATE_UNICODE;
        break;
      case DotStringsParser.TOK_ZERO:
        this.buffer.push('\0');
        break;
      default:
        if (this.strict) {
          this.raiseError(`Unexpected character '${ch}'`);
        } else {
          this.buffer.push(ch);
        }
    }
  }

  // rubocop:enable Metrics/CyclomaticComplexity

  // rubocop:disable Metrics/CyclomaticComplexity, Metrics/PerceivedComplexity

  private parseUnicode(
    ch: string,
    callback: (unicodeCh: string) => void,
  ): void {
    if (!DotStringsParser.TOK_HEX_DIGIT.test(ch)) {
      this.raiseError(`Unexpected character '${ch}', expecting a hex digit`);
    }

    this.unicodeBuffer.push(ch);

    // Check if we have enough digits to form a codepoint.
    if (this.unicodeBuffer.length < 4) {
      return;
    }

    const codepoint = parseInt(this.unicodeBuffer.join(''), 16);

    if (codepoint >= 0xd800 && codepoint <= 0xdbff) {
      if (this.highSurrogate !== null) {
        this.raiseError(
          'Found a high surrogate code point after another high surrogate',
        );
      }

      this.highSurrogate = codepoint;
      this.state = DotStringsParser.STATE_UNICODE_SURROGATE;
    } else if (codepoint >= 0xdc00 && codepoint <= 0xdfff) {
      if (this.highSurrogate === null) {
        this.raiseError(
          'Found a low surrogate code point before a high surrogate',
        );
      }

      const character = String.fromCharCode(
        (this.highSurrogate - 0xd800) * 0x400 + (codepoint - 0xdc00) + 0x10000,
      );
      this.highSurrogate = null;

      callback(character);
    } else {
      if (this.highSurrogate !== null) {
        this.raiseError(
          `Invalid unicode codepoint '\\U${codepoint
            .toString(16)
            .toUpperCase()}' after a high surrogate code point`,
        );
      }

      callback(String.fromCharCode(codepoint));
    }

    // Clear buffer after codepoint is parsed
    this.unicodeBuffer.length = 0;
  }

  // rubocop:enable Metrics/CyclomaticComplexity, Metrics/PerceivedComplexity

  private updatePosition(ch: string): void {
    this.offset += 1;

    if (ch === DotStringsParser.TOK_NEW_LINE) {
      this.column = 1;
      this.line += 1;
    } else {
      this.column += 1;
    }
  }

  private startValue(ch: string, resets: boolean = true): void {
    switch (ch) {
      case DotStringsParser.TOK_SLASH:
        this.state = DotStringsParser.STATE_COMMENT_START;
        if (resets) {
          this.resetState();
        }
        break;
      case DotStringsParser.TOK_QUOTE:
        this.state = DotStringsParser.STATE_KEY;
        if (resets) {
          this.resetState();
        }
        break;
      default:
        if (!this.whitespace(ch)) {
          this.raiseError(`Unexpected character '${ch}'`);
        }
    }
  }

  private commentEnd(ch: string): void {
    if (this.strict) {
      // In strict mode, we expect a key to follow the comment.
      if (ch === DotStringsParser.TOK_QUOTE) {
        this.state = DotStringsParser.STATE_KEY;
      } else {
        if (!this.whitespace(ch)) {
          this.raiseError(`Unexpected character '${ch}'`);
        }
      }
    } else {
      // In lenient mode, we allow comments to be followed by anything.
      this.startValue(ch, false);
    }
  }

  private resetState(): void {
    this.currentComment = null;
    this.currentKey = null;
    this.currentValue = null;
  }

  private whitespace(ch: string): boolean {
    return ch.trim().length === 0;
  }
}

// rubocop:enable Metrics/ClassLength

export class DotStringsItem {
  public readonly comment: string | null;
  public readonly key: string | null;
  public readonly value: string | null;

  constructor(
    comment: string | null,
    key: string | null,
    value: string | null,
  ) {
    this.comment = comment;
    this.key = key;
    this.value = value;
  }

  public toString(
    escapeSingleQuotes: boolean = false,
    includeComment: boolean = true,
  ): string {
    const result: string[] = [];

    if (this.comment && includeComment) {
      result.push(`/* ${this.comment} */`);
    }
    result.push(
      `"${this.serializeString(
        this.key,
        escapeSingleQuotes,
      )}" = "${this.serializeString(this.value, escapeSingleQuotes)}";`,
    );

    return result.join('\n');
  }

  private serializeString(
    str: string | null,
    escapeSingleQuotes: boolean,
  ): string {
    if (str === null) {
      return '';
    }

    const replacements: [string, string][] = [
      ['"', '\\"'],
      ['\t', '\\t'],
      ['\n', '\\n'],
      ['\r', '\\r'],
      ['\0', '\\0'],
    ];

    if (escapeSingleQuotes) {
      replacements.push(["'", "\\'"]); // Escape single quotes
    }

    return replacements.reduce((acc, [from, to]) => {
      return acc.replaceAll(from, to);
    }, str);
  }
}
