import { logger } from '@repo/base/logger';
import ora, { Ora } from 'ora';

export interface Spinner {
  next(message: string, options?: { logging: boolean }): Spinner;
  start(options?: { logging: boolean }): Spinner;
  update(message?: string, options?: { logging: boolean }): Spinner;
  fail(message?: string, options?: { logging: boolean }): Spinner;
  succeed(message?: string, options?: { logging: boolean }): Spinner;
  stop(options?: { persist?: boolean }): Spinner;
}

class OraSpinner {
  private ora: Ora;

  constructor() {
    this.ora = ora();
  }

  /**
   * Start a new line of spinner
   * @param message
   * @param options logger: whether to log the message as well
   * @returns
   */
  next(message: string) {
    this.ora = ora(message);
    return this;
  }

  start(options: { logging: boolean } = { logging: true }) {
    this.ora.start();
    if (options.logging && this.ora.text.length > 0) {
      logger.info(this.ora.text);
    }
    return this;
  }

  update(message: string, options: { logging: boolean } = { logging: true }) {
    this.ora.text = message;
    this.start(options);
    return this;
  }

  fail(message?: string, options: { logging: boolean } = { logging: true }) {
    this.ora.fail(message);
    if (message && options.logging) {
      logger.error(message);
    }
    return this;
  }

  succeed(message?: string, options: { logging: boolean } = { logging: true }) {
    this.ora.succeed(message);
    if (message && options.logging) {
      logger.info(message);
    }
    return this;
  }

  stop(options?: { persist?: boolean }) {
    if (options?.persist !== undefined && options.persist) {
      this.ora.stopAndPersist();
    } else {
      this.ora.stop();
    }
    return this;
  }
}

export default new OraSpinner();
