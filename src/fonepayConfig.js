export const FONEPAY_CONFIG = {
  // Digital payment remains deliberately disabled until a server-side intent
  // and provider signature verification are configured. Never route a family
  // to a placeholder merchant or gateway URL.
  MERCHANT_CODE: process.env.REACT_APP_FONEPAY_MERCHANT_CODE || "",
  PAYMENT_GATEWAY_URL: process.env.REACT_APP_FONEPAY_GATEWAY_URL || "",
};

export const generateRefId = () => {
  return `SEWAK_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const validatePaymentResponse = (response) => {
  if (!response.refId || !response.amount) {
    return false;
  }
  return true;
};
