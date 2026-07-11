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
    .replace(/\s+/g, ' ')
    .trim();

const extractAmount = (text) => {
    const normalized = normalizeOcrText(text);
    const labeledPatterns = [
        /(?:จำนวนเงิน|ยอดเงิน|ยอดที่ตรวจพบ|amount)\s*[:：-]?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
        /(?:฿|บาท)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
    ];

    for (const pattern of labeledPatterns) {
        const match = normalized.match(pattern);
        if (match?.[1]) return match[1].replace(/,/g, '');
    }

    const fallbackMatch = normalized.match(/\b([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(?:บาท|฿)\b/);
    return fallbackMatch?.[1]?.replace(/,/g, '') || '';
};

const extractReference = (text) => {
    const normalized = normalizeOcrText(text);
    const patterns = [
        /(?:รหัสอ้างอิง|เลขอ้างอิง|อ้างอิง|transaction(?:\s*id)?|reference|ref|เลขที่รายการ)\s*[:：-]?\s*([A-Za-z0-9][A-Za-z0-9\s_/-]{4,})/i,
        /\b([A-Za-z]{1,5}\d{5,}[A-Za-z0-9_/-]*)\b/,
    ];

    for (const pattern of patterns) {
        const match = normalized.match(pattern);
        if (match?.[1]) return match[1].trim().replace(/\s+/g, ' ');
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
