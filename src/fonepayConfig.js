export const FONEPAY_CONFIG = {
  MERCHANT_CODE: process.env.REACT_APP_FONEPAY_MERCHANT_CODE || "GHAR_SATHI_001",
  PAYMENT_GATEWAY_URL: process.env.REACT_APP_FONEPAY_GATEWAY_URL || "https://fonepay.com/",
};

export const generateRefId = () => {
  return `GHAR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const validatePaymentResponse = (response) => {
  if (!response.refId || !response.amount) {
    return false;
  }
  return true;
};
