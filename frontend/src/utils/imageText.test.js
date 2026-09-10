import { extractPaymentReviewData } from './imageText';

describe('extractPaymentReviewData', () => {
    test('extracts labeled Thai transfer amount and reference from OCR text', () => {
        const result = extractPaymentReviewData(`
            โอนเงินสำเร็จ
            จำนวนเงิน: ฿1,250.50 บาท
            เลขอ้างอิง: LRU202609100001
            วันที่ 10/09/2026
        `);

        expect(result).toEqual({
            verified_amount: '1250.50',
            transaction_ref: 'LRU202609100001',
        });
    });

    test('uses the largest formatted amount as a fallback and ignores account-like references', () => {
        const result = extractPaymentReviewData(`
            จากบัญชี xxx1234
            20.00
            1,500.00
            TXN9988776655
        `);

        expect(result.verified_amount).toBe('1500.00');
        expect(result.transaction_ref).toBe('TXN9988776655');
    });

    test('returns empty strings when OCR text has no usable payment data', () => {
        expect(extractPaymentReviewData('โอนเงิน วันที่ 10/09/2026 เวลา 10:30')).toEqual({
            verified_amount: '',
            transaction_ref: '',
        });
    });
});
