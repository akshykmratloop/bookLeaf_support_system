import { AppError } from '../platform/errors.js';

/** The host product did not answer in time, failed, or sent data that breaks the contract. */
export class HostUnavailableError extends AppError {
  constructor(reason: string) {
    super(503, 'HOST_UNAVAILABLE', `Customer records are not available right now (${reason}).`);
  }
}

/** The host does not know this customer (any more). */
export class CustomerNotFoundError extends AppError {
  constructor() {
    super(404, 'CUSTOMER_NOT_FOUND', 'This account is not known to the product.');
  }
}
