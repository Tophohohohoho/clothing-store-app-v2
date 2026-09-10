import {
    getCartCount,
    getCartItemKey,
    getCartTotal,
    getItemPrice,
    getItemQuantity,
} from './cart';

describe('cart utilities', () => {
    test('normalizes prices from supported item fields and formatted strings', () => {
        expect(getItemPrice({ price: '฿1,250.50' })).toBe(1250.5);
        expect(getItemPrice({ product_price: '300 บาท' })).toBe(300);
        expect(getItemPrice({ p_price: 49.99 })).toBe(49.99);
        expect(getItemPrice({ price: 'free' })).toBe(0);
        expect(getItemPrice({})).toBe(0);
    });

    test('normalizes quantities and falls back to one for missing or invalid values', () => {
        expect(getItemQuantity({ qty: '3' })).toBe(3);
        expect(getItemQuantity({ quantity: 2 })).toBe(2);
        expect(getItemQuantity({ amount: '5 items' })).toBe(5);
        expect(getItemQuantity({ qty: 'abc' })).toBe(1);
        expect(getItemQuantity({})).toBe(1);
    });

    test('calculates total and count across mixed cart item shapes', () => {
        const cart = [
            { id: 10, price: '฿100.00', qty: '2' },
            { id: 'sku-2', product_price: '50', quantity: 3 },
            { id: 99, p_price: '20 บาท', amount: 'bad' },
        ];

        expect(getCartTotal(cart)).toBe(370);
        expect(getCartCount(cart)).toBe(6);
        expect(getCartItemKey(cart[0])).toBe('10');
        expect(getCartItemKey(cart[1])).toBe('sku-2');
    });
});
