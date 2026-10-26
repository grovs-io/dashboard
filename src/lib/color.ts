const COLOR = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;
export const isColor = (value: string) => COLOR.test(value);

// Strict #RRGGBB, no alpha. Matches the backend for smart banners.
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
export const isHexColor = (value: string) => HEX_COLOR.test(value);
