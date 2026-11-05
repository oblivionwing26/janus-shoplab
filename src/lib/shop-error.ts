export type ShopErrorCode =
  | 'invalid_input'
  | 'email_taken'
  | 'invalid_credentials'
  | 'unauthenticated'
  | 'not_found'
  | 'out_of_stock'
  | 'empty_cart'
  | 'coupon_invalid'
  | 'coupon_used';

const STATUS: Record<ShopErrorCode, number> = {
  invalid_input: 400,
  email_taken: 409,
  invalid_credentials: 401,
  unauthenticated: 401,
  not_found: 404,
  out_of_stock: 409,
  empty_cart: 409,
  coupon_invalid: 422,
  coupon_used: 409,
};

/** An expected failure with a stable code and a message safe to show to the shopper. */
export class ShopError extends Error {
  readonly status: number;

  constructor(
    readonly code: ShopErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ShopError';
    this.status = STATUS[code];
  }
}
