export const getItemPrice = (item) => {
    const rawPrice = item.price || item.product_price || item.p_price || 0;
    const cleanPrice = String(rawPrice).replace(/[^\d.]/g, '');
    return parseFloat(cleanPrice) || 0;
};

export const getItemQuantity = (item) => {
    return parseInt(item.qty || item.quantity || item.amount || 1, 10) || 1;
};

export const getCartTotal = (cart) => {
    return cart.reduce((sum, item) => sum + getItemPrice(item) * getItemQuantity(item), 0);
};

export const getCartCount = (cart) => {
    return cart.reduce((sum, item) => sum + getItemQuantity(item), 0);
};
