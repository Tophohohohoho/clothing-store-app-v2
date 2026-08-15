let workerPromise = null;

const OCR_LANGS = ['tha', 'eng'];
const OCR_OPTIONS = {
    langPath: 'https://tessdata.projectnaptha.com/4.0.0',
};

const getWorker = async () => {
    if (!workerPromise) {
        workerPromise = import('tesseract.js')
            .then(async ({ createWorker }) => createWorker(OCR_LANGS, 1, OCR_OPTIONS))
            .catch((error) => {
                workerPromise = null;
                throw error;
            });
    }

    return workerPromise;
};

export const extractTextFromImage = async (imageSrc) => {
    const worker = await getWorker();
    let objectUrl = '';

    try {
        let source = imageSrc;
        if (typeof imageSrc === 'string' && imageSrc && !imageSrc.startsWith('data:') && !imageSrc.startsWith('blob:')) {
            const response = await fetch(imageSrc);
            if (response.ok) {
                const blob = await response.blob();
                objectUrl = URL.createObjectURL(blob);
                source = objectUrl;
            }
        }

        const { data } = await worker.recognize(source, {
            rotateAuto: true,
        });
        return String(data?.text || '').trim();
    } finally {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
};

const normalizeOcrText = (text) => String(text || '')
    .replace(/\u00A0/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[|]/g, 'I')
    .replace(/[：]/g, ':')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeOcrLines = (text) => String(text || '')
    .replace(/\u00A0/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[|]/g, 'I')
    .replace(/[：]/g, ':')
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

const cleanAmount = (value) => {
    const cleaned = String(value || '')
        .replace(/[^\d.,]/g, '')
        .replace(/,/g, '');
    const amount = Number(cleaned);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10000000) return '';
    return amount.toFixed(2);
};

const extractAmount = (text) => {
    const normalized = normalizeOcrText(text);
    const lines = normalizeOcrLines(text);
    const labeledPatterns = [
        /(?:จำนวนเงิน|ยอดเงิน|ยอดโอน|ยอดชำระ|ยอดที่ตรวจพบ|เงินเข้า|จำนวน|transfer\s*amount|transaction\s*amount|total\s*amount|amount|paid)\s*[:-]?\s*(?:THB|Baht|บาท|฿)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
        /(?:THB|Baht|บาท|฿)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
        /([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(?:THB|Baht|บาท|฿)/i,
    ];

    for (const pattern of labeledPatterns) {
        const match = normalized.match(pattern);
        const amount = cleanAmount(match?.[1]);
        if (amount) return amount;
    }

    const amountLabelPattern = /(จำนวนเงิน|ยอดเงิน|ยอดโอน|ยอดชำระ|เงินเข้า|amount|paid|total)/i;
    for (let index = 0; index < lines.length; index += 1) {
        if (!amountLabelPattern.test(lines[index])) continue;
        const nearbyText = lines.slice(index, index + 3).join(' ');
        for (const pattern of labeledPatterns) {
            const match = nearbyText.match(pattern);
            const amount = cleanAmount(match?.[1]);
            if (amount) return amount;
        }
        const looseMatch = nearbyText.match(/([0-9][0-9,]*(?:\.[0-9]{1,2})?)/);
        const amount = cleanAmount(looseMatch?.[1]);
        if (amount) return amount;
    }

    const fallbackAmounts = [...normalized.matchAll(/(?:THB|Baht|บาท|฿)?\s*\b([0-9][0-9,]+\.[0-9]{2})\b\s*(?:THB|Baht|บาท|฿)?/gi)]
        .map((match) => cleanAmount(match[1]))
        .filter(Boolean)
        .map(Number)
        .filter((amount) => amount > 0);
    if (fallbackAmounts.length) return Math.max(...fallbackAmounts).toFixed(2);

    return '';
};

const cleanReference = (value) => {
    const cleaned = String(value || '')
        .replace(/^[\s:#./-]+/, '')
        .replace(/\s*(?:วันที่|วันที|เวลา|จำนวนเงิน|ยอดเงิน|amount|from|to|ผู้โอน|ผู้รับ|บัญชี|account).*$/i, '')
        .replace(/\s+/g, '')
        .replace(/[^A-Za-z0-9/-]/g, '')
        .trim();
    if (cleaned.length < 6 || cleaned.length > 35) return '';
    if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(cleaned)) return '';
    if (/^\d{1,2}[:.]\d{2}/.test(cleaned)) return '';
    if (/^(?:x+|\*+)?\d{3,4}$/i.test(cleaned)) return '';
    return cleaned;
};

const extractReference = (text) => {
    const normalized = normalizeOcrText(text);
    const lines = normalizeOcrLines(text);
    const referenceLabelPattern = /(?:รหัสอ้างอิง|เลขอ้างอิง|หมายเลขอ้างอิง|อ้างอิง|รหัสรายการ|เลขที่รายการ|หมายเลขรายการ|เลขรายการ|transaction(?:\s*(?:id|no|number))?|reference(?:\s*(?:id|no|number))?|ref(?:erence)?|trace\s*(?:no|number)?|slip\s*(?:id|no|number)?|promptpay\s*ref)/i;
    const skipReferenceLinePattern = /(?:บัญชี|account|เลขที่บัญชี|พร้อมเพย์|promptpay|โทร|phone|mobile|ผู้โอน|ผู้รับ|from|to|จำนวนเงิน|ยอดเงิน|amount|วันที่|เวลา|date|time)/i;
    const patterns = [
        /(?:รหัสอ้างอิง|เลขอ้างอิง|หมายเลขอ้างอิง|อ้างอิง|รหัสรายการ|เลขที่รายการ|หมายเลขรายการ|เลขรายการ|transaction(?:\s*(?:id|no|number))?|reference(?:\s*(?:id|no|number))?|ref(?:erence)?|trace\s*(?:no|number)?|slip\s*(?:id|no|number)?|promptpay\s*ref)\s*[:-]?\s*([A-Za-z0-9][A-Za-z0-9\s._/-]{5,})/i,
        /\b([A-Za-z]{1,8}\d{5,}[A-Za-z0-9_/-]*)\b/,
    ];

    for (const pattern of patterns) {
        const match = normalized.match(pattern);
        const reference = cleanReference(match?.[1]);
        if (reference) return reference;
    }

    for (let index = 0; index < lines.length; index += 1) {
        if (!referenceLabelPattern.test(lines[index])) continue;
        const nearbyLines = lines.slice(index, index + 3);
        for (const line of nearbyLines) {
            const afterLabel = line.replace(referenceLabelPattern, '');
            const inlineReference = cleanReference(afterLabel);
            if (inlineReference) return inlineReference;

            const candidates = line.match(/[A-Za-z0-9][A-Za-z0-9 ._/-]{5,}/g) || [];
            for (const candidate of candidates) {
                const reference = cleanReference(candidate);
                if (reference) return reference;
            }
        }
    }

    const fallbackCandidates = lines
        .filter((line) => !skipReferenceLinePattern.test(line))
        .flatMap((line) => line.match(/\b[A-Za-z0-9][A-Za-z0-9/-]{9,34}\b/g) || [])
        .map(cleanReference)
        .filter(Boolean)
        .filter((candidate) => !/^\d{8}$/.test(candidate) && !/^\d{10}$/.test(candidate));

    if (fallbackCandidates.length) {
        return fallbackCandidates.sort((a, b) => b.length - a.length)[0];
    }

    return '';
};

export const extractPaymentReviewData = (text) => ({
    verified_amount: extractAmount(text),
    transaction_ref: extractReference(text),
});

export const copyTextToClipboard = async (text) => {
    const value = String(text || '');
    if (!value.trim()) return false;

    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
    }

    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();

    try {
        const result = document.execCommand('copy');
        return Boolean(result);
    } finally {
        document.body.removeChild(textarea);
    }
};
