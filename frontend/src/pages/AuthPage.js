import { useEffect, useMemo, useRef, useState } from 'react';
import { requestPasswordReset, requestRegisterOtp, resetPasswordWithCode, verifyPasswordResetCode, verifyRegisterOtp } from '../api/authApi';
import { alertNotification } from '../components/AppNotification';

const EMPTY_FORGOT_FORM = {
    email: '',
    code: '',
    password: '',
    confirmPassword: '',
};
const EMPTY_RESET_CODE_DIGITS = ['', '', '', '', '', ''];
const REGISTER_OTP_EXPIRES_SECONDS = 10 * 60;
const REGISTER_OTP_RESEND_SECONDS = 60;
const EMPTY_THAI_ADDRESS_DATA = {
    provinces: [],
    districts: [],
    subDistricts: [],
};
const getPublicJsonPath = (fileName) => `${process.env.PUBLIC_URL || ''}/api-thai/json/${fileName}`;
const getName = (item) => item?.name_th || '';
const getZipCode = (item) => (item?.zip_code ? String(item.zip_code) : '');
const PRIVACY_NOTICE_SECTIONS = [
    {
        title: 'ผู้ควบคุมข้อมูลส่วนบุคคล',
        text: 'มหาวิทยาลัยราชภัฏเลย เลขที่ 234 ถนนเลย-เชียงคาน ตำบลเมือง อำเภอเมืองเลย จังหวัดเลย 42000 โทรศัพท์ 042-835224-8 เว็บไซต์ www.lru.ac.th',
    },
    {
        title: 'ข้อมูลที่จำเป็นต่อการสมัครและสั่งซื้อ',
        text: 'ระบบเก็บเฉพาะข้อมูลส่วนบุคคลที่จำเป็น เช่น ชื่อผู้ใช้ ชื่อ-นามสกุล อีเมล เบอร์โทรศัพท์ ที่อยู่จัดส่ง รายการสั่งซื้อ และรหัสผ่านที่จัดเก็บเป็นแฮชอย่างปลอดภัย',
    },
    {
        title: 'วัตถุประสงค์การใช้ข้อมูล',
        text: 'ใช้ข้อมูลเพื่อสมัครบัญชี ยืนยันตัวตน เข้าสู่ระบบ ติดต่อผู้ใช้ จัดส่งสินค้า และให้บริการช่วยเหลือลูกค้าเท่านั้น',
    },
    {
        title: 'ความปลอดภัยและการเปิดเผยข้อมูล',
        text: 'ระบบควรใช้งานผ่าน HTTPS จำกัดสิทธิ์การเข้าถึงข้อมูล และไม่เปิดเผยข้อมูลส่วนบุคคล ยกเว้นผู้ให้บริการขนส่ง หน้าที่ตามกฎหมาย หรือได้รับความยินยอมจากผู้ใช้',
    },
    {
        title: 'สิทธิของเจ้าของข้อมูล',
        text: 'เจ้าของข้อมูลมีสิทธิเข้าถึง ขอสำเนา แก้ไข ลบหรือทำลาย ระงับการใช้ คัดค้านการประมวลผล และขอโอนย้ายข้อมูลส่วนบุคคลตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562',
    },
];

function AuthPage({
    isRegisterView,
    setIsRegisterView,
    loginForm,
    setLoginForm,
    rememberLogin,
    setRememberLogin,
    registerForm,
    setRegisterForm,
    registerFieldErrors,
    setRegisterFieldErrors,
    loginError,
    isLoginLoading,
    registerMsg,
    onLogin,
    onRegister,
}) {
    const [showLoginPassword, setShowLoginPassword] = useState(false);
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [forgotStep, setForgotStep] = useState('request');
    const [forgotForm, setForgotForm] = useState(EMPTY_FORGOT_FORM);
    const [forgotCodeDigits, setForgotCodeDigits] = useState(EMPTY_RESET_CODE_DIGITS);
    const [registerOtpDigits, setRegisterOtpDigits] = useState(EMPTY_RESET_CODE_DIGITS);
    const [forgotMsg, setForgotMsg] = useState({ type: '', text: '' });
    const [isForgotLoading, setIsForgotLoading] = useState(false);
    const [showPrivacyNotice, setShowPrivacyNotice] = useState(false);
    const [hasScrolledPrivacyNotice, setHasScrolledPrivacyNotice] = useState(false);
    const [consentNotice, setConsentNotice] = useState('');
    const [registerOtpMsg, setRegisterOtpMsg] = useState({ type: '', text: '' });
    const [isRegisterOtpLoading, setIsRegisterOtpLoading] = useState(false);
    const [isRegisterOtpVerified, setIsRegisterOtpVerified] = useState(false);
    const [registerOtpRequested, setRegisterOtpRequested] = useState(false);
    const [registerStep, setRegisterStep] = useState('email');
    const [registerOtpExpiresAt, setRegisterOtpExpiresAt] = useState(null);
    const [registerOtpCanResendAt, setRegisterOtpCanResendAt] = useState(null);
    const [currentTime, setCurrentTime] = useState(() => Date.now());
    const [thaiAddressData, setThaiAddressData] = useState(EMPTY_THAI_ADDRESS_DATA);
    const [isThaiAddressLoading, setIsThaiAddressLoading] = useState(true);
    const resetCodeInputRefs = useRef([]);
    const registerOtpInputRefs = useRef([]);
    const registerFieldRefs = useRef({});
    const forgotCode = forgotCodeDigits.join('');
    const registerOtpRemainingSeconds = registerOtpExpiresAt
        ? Math.max(0, Math.ceil((registerOtpExpiresAt - currentTime) / 1000))
        : 0;
    const registerOtpResendSeconds = registerOtpCanResendAt
        ? Math.max(0, Math.ceil((registerOtpCanResendAt - currentTime) / 1000))
        : 0;
    const hasActiveRegisterOtp = Boolean(registerOtpExpiresAt && registerOtpRemainingSeconds > 0);
    const registerOtpRequestLabel = registerOtpExpiresAt ? 'ขอ OTP ใหม่' : 'ส่งรหัส OTP';

    const formatOtpTime = (totalSeconds) => {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${String(seconds).padStart(2, '0')}`;
    };

    const selectedProvince = useMemo(
        () => thaiAddressData.provinces.find((province) => getName(province) === registerForm.province),
        [registerForm.province, thaiAddressData.provinces],
    );
    const districtChoices = useMemo(
        () => selectedProvince ? thaiAddressData.districts.filter((district) => district.province_id === selectedProvince.id) : [],
        [selectedProvince, thaiAddressData.districts],
    );
    const selectedDistrict = useMemo(
        () => districtChoices.find((district) => getName(district) === registerForm.district),
        [registerForm.district, districtChoices],
    );
    const subDistrictChoices = useMemo(
        () => selectedDistrict ? thaiAddressData.subDistricts.filter((subDistrict) => subDistrict.district_id === selectedDistrict.id) : [],
        [selectedDistrict, thaiAddressData.subDistricts],
    );
    const postalCodeChoices = useMemo(() => {
        const postalCodes = subDistrictChoices.map(getZipCode).filter(Boolean);
        return [...new Set(postalCodes)];
    }, [subDistrictChoices]);

    const switchToLogin = () => {
        setIsRegisterView(false);
        setRegisterStep('email');
    };

    const switchToRegister = () => {
        setIsRegisterView(true);
        if (!isRegisterOtpVerified) setRegisterStep('email');
    };

    const closeForgotPassword = () => {
        setShowForgotPassword(false);
        setForgotStep('request');
        setForgotForm(EMPTY_FORGOT_FORM);
        setForgotCodeDigits(EMPTY_RESET_CODE_DIGITS);
        setForgotMsg({ type: '', text: '' });
        setIsForgotLoading(false);
    };

    const openForgotPassword = () => {
        setForgotForm(EMPTY_FORGOT_FORM);
        setForgotCodeDigits(EMPTY_RESET_CODE_DIGITS);
        setForgotStep('request');
        setForgotMsg({ type: '', text: '' });
        setShowForgotPassword(true);
    };

    const openPrivacyNotice = () => {
        setShowPrivacyNotice(true);
        setHasScrolledPrivacyNotice(false);
        if (registerFieldErrors?.privacyNoticeAcknowledged) {
            setRegisterFieldErrors((current) => {
                const nextErrors = { ...current };
                delete nextErrors.privacyNoticeAcknowledged;
                return nextErrors;
            });
        }
    };

    const acknowledgePrivacyNotice = () => {
        setRegisterForm({
            ...registerForm,
            privacyNoticeAcknowledged: true,
        });
        setConsentNotice('');
        setRegisterFieldErrors((current) => {
            const nextErrors = { ...current };
            delete nextErrors.privacyNoticeAcknowledged;
            return nextErrors;
        });
        setShowPrivacyNotice(false);
    };

    const handlePrivacyScroll = (event) => {
        const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
        if (scrollTop + clientHeight >= scrollHeight - 4) {
            setHasScrolledPrivacyNotice(true);
        }
    };

    const requestPrivacyBeforeConsent = () => {
        if (!registerForm.privacyNoticeAcknowledged) {
            setRegisterFieldErrors({ privacyNoticeAcknowledged: 'กรุณาอ่าน Privacy Policy / นโยบายความเป็นส่วนตัวก่อน' });
            setConsentNotice('');
            alertNotification({
                type: 'warning',
                title: 'ยังไม่ได้อ่าน Privacy Policy / นโยบายความเป็นส่วนตัว',
                message: 'กรุณาอ่าน Privacy Policy / นโยบายความเป็นส่วนตัวก่อน แล้วค่อยเลือกความยินยอม',
                buttonText: 'กลับไปอ่าน',
            });
        }
    };

    const handleConsentChange = (event) => {
        if (!registerForm.privacyNoticeAcknowledged) {
            setRegisterFieldErrors({ privacyNoticeAcknowledged: 'กรุณาอ่าน Privacy Policy / นโยบายความเป็นส่วนตัวก่อน' });
            setConsentNotice('');
            alertNotification({
                type: 'warning',
                title: 'ยังไม่ได้อ่าน Privacy Policy / นโยบายความเป็นส่วนตัว',
                message: 'กรุณาอ่าน Privacy Policy / นโยบายความเป็นส่วนตัวก่อน แล้วค่อยเลือกความยินยอม',
                buttonText: 'กลับไปอ่าน',
            });
            return;
        }

        setConsentNotice('');
        setRegisterForm({ ...registerForm, consentAnalytics: event.target.checked });
    };

    useEffect(() => {
        const firstFieldWithError = Object.keys(registerFieldErrors || {})[0];
        if (!firstFieldWithError) return;

        const targetField = registerFieldRefs.current[firstFieldWithError];
        if (!targetField) return;

        targetField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        window.setTimeout(() => {
            targetField.focus({ preventScroll: true });
        }, 160);
    }, [registerFieldErrors]);

    useEffect(() => {
        let isMounted = true;

        Promise.all([
            fetch(getPublicJsonPath('provinces.json')).then((response) => response.json()),
            fetch(getPublicJsonPath('districts.json')).then((response) => response.json()),
            fetch(getPublicJsonPath('sub_districts.json')).then((response) => response.json()),
        ])
            .then(([provinces, districts, subDistricts]) => {
                if (!isMounted) return;
                setThaiAddressData({
                    provinces: provinces.filter((province) => !province.deleted_at),
                    districts: districts.filter((district) => !district.deleted_at),
                    subDistricts: subDistricts.filter((subDistrict) => !subDistrict.deleted_at),
                });
            })
            .catch(() => {
                if (isMounted) setThaiAddressData(EMPTY_THAI_ADDRESS_DATA);
            })
            .finally(() => {
                if (isMounted) setIsThaiAddressLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        if (!registerOtpExpiresAt && !registerOtpCanResendAt) return undefined;

        const timer = window.setInterval(() => {
            setCurrentTime(Date.now());
        }, 1000);

        return () => window.clearInterval(timer);
    }, [registerOtpExpiresAt, registerOtpCanResendAt]);

    useEffect(() => {
        if (isRegisterView) return;

        setRegisterStep('email');
        setIsRegisterOtpVerified(false);
        setRegisterOtpMsg({ type: '', text: '' });
        setRegisterOtpExpiresAt(null);
        setRegisterOtpCanResendAt(null);
        setRegisterOtpRequested(false);
    }, [isRegisterView]);

    const handleRegisterFieldChange = (field, value) => {
        const nextValue = field === 'registrationOtp' ? value.replace(/\D/g, '').slice(0, 6) : value;
        setRegisterForm({ ...registerForm, [field]: nextValue });
        if (field === 'registrationOtp') {
            const nextDigits = EMPTY_RESET_CODE_DIGITS.map((_, index) => nextValue[index] || '');
            setRegisterOtpDigits(nextDigits);
        }
        if (field === 'email' || field === 'registrationOtp') {
            setIsRegisterOtpVerified(false);
            if (field === 'email') {
                setRegisterStep('email');
                setRegisterOtpExpiresAt(null);
                setRegisterOtpCanResendAt(null);
                setRegisterOtpRequested(false);
                setRegisterOtpDigits(EMPTY_RESET_CODE_DIGITS);
            }
            setRegisterOtpMsg((message) => (message.type === 'success' ? { type: '', text: '' } : message));
        }
        if (registerFieldErrors?.[field]) {
            setRegisterFieldErrors((current) => {
                const nextErrors = { ...current };
                delete nextErrors[field];
                return nextErrors;
            });
        }
    };

    const clearRegisterFieldErrors = (...fields) => {
        setRegisterFieldErrors((current) => {
            const nextErrors = { ...current };
            fields.forEach((field) => {
                delete nextErrors[field];
            });
            return nextErrors;
        });
    };

    const handleRegisterProvinceChange = (provinceName) => {
        setRegisterForm({
            ...registerForm,
            province: provinceName,
            district: '',
            subdistrict: '',
            postal_code: '',
        });
        clearRegisterFieldErrors('province', 'district', 'subdistrict', 'postal_code');
    };

    const handleRegisterDistrictChange = (districtName) => {
        setRegisterForm({
            ...registerForm,
            district: districtName,
            subdistrict: '',
            postal_code: '',
        });
        clearRegisterFieldErrors('district', 'subdistrict', 'postal_code');
    };

    const handleRegisterSubDistrictChange = (subDistrictName) => {
        const selectedSubDistrict = subDistrictChoices.find((subDistrict) => getName(subDistrict) === subDistrictName);
        setRegisterForm({
            ...registerForm,
            subdistrict: subDistrictName,
            postal_code: getZipCode(selectedSubDistrict),
        });
        clearRegisterFieldErrors('subdistrict', 'postal_code');
    };

    const setRegisterOtpCode = (nextDigits) => {
        const nextCode = nextDigits.join('').slice(0, 6);
        setRegisterOtpDigits(nextDigits);
        setRegisterForm((currentForm) => ({ ...currentForm, registrationOtp: nextCode }));
        setIsRegisterOtpVerified(false);
        setRegisterOtpMsg((message) => (message.type === 'error' ? { type: '', text: '' } : message));
        clearRegisterFieldErrors('registrationOtp');
    };

    const getFirstEmptyRegisterOtpIndex = () => {
        const firstEmptyIndex = registerOtpDigits.findIndex((digit) => !digit);
        return firstEmptyIndex === -1 ? 5 : firstEmptyIndex;
    };

    const keepRegisterOtpFocusInOrder = (index) => {
        const firstEmptyIndex = getFirstEmptyRegisterOtpIndex();
        if (index > firstEmptyIndex) {
            registerOtpInputRefs.current[firstEmptyIndex]?.focus();
            return false;
        }
        return true;
    };

    const setRegisterOtpAtIndex = (index, value) => {
        if (!keepRegisterOtpFocusInOrder(index)) return;

        const cleanValue = value.replace(/\D/g, '').slice(0, 6);
        if (cleanValue.length > 1) {
            const nextDigits = [...registerOtpDigits];
            cleanValue.split('').forEach((digit, offset) => {
                const nextIndex = offset;
                if (nextIndex < 6) nextDigits[nextIndex] = digit;
            });
            setRegisterOtpCode(nextDigits);
            registerOtpInputRefs.current[Math.min(cleanValue.length, 5)]?.focus();
            return;
        }

        const nextDigits = [...registerOtpDigits];
        nextDigits[index] = cleanValue;
        setRegisterOtpCode(nextDigits);

        if (cleanValue && index < 5) {
            registerOtpInputRefs.current[index + 1]?.focus();
        }
    };

    const handleRegisterOtpPaste = (event) => {
        event.preventDefault();
        const pastedCode = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (!pastedCode) return;

        const nextDigits = [...registerOtpDigits];
        pastedCode.split('').forEach((digit, offset) => {
            const nextIndex = offset;
            if (nextIndex < 6) nextDigits[nextIndex] = digit;
        });

        setRegisterOtpCode(nextDigits);
        registerOtpInputRefs.current[Math.min(pastedCode.length, 5)]?.focus();
    };

    const handleRegisterOtpFocus = (index) => {
        keepRegisterOtpFocusInOrder(index);
    };

    const handleRegisterOtpKeyDown = (event, index) => {
        if (event.key === 'Backspace' && !registerOtpDigits[index] && index > 0) {
            registerOtpInputRefs.current[index - 1]?.focus();
        }
        if (event.key === 'ArrowLeft' && index > 0) {
            event.preventDefault();
            registerOtpInputRefs.current[index - 1]?.focus();
        }
        if (event.key === 'ArrowRight' && index < 5) {
            event.preventDefault();
            registerOtpInputRefs.current[index + 1]?.focus();
        }
    };

    const setRegisterFieldRef = (field) => (element) => {
        registerFieldRefs.current[field] = element;
    };

    const getForgotError = (err, fallback) => err?.response?.data?.message || err?.response?.data?.error || fallback;
    const getRegisterOtpError = (err, fallback) => err?.response?.data?.message || err?.response?.data?.error || fallback;

    const handleRequestRegisterOtp = async () => {
        const email = registerForm.email.trim();
        if (!email) {
            setRegisterFieldErrors({ email: 'กรุณากรอกอีเมลก่อนขอรหัส OTP' });
            setRegisterOtpMsg({ type: 'error', text: 'กรุณากรอกอีเมลก่อนขอรหัส OTP' });
            return;
        }

        setIsRegisterOtpLoading(true);
        setIsRegisterOtpVerified(false);
        setRegisterStep('email');
        setRegisterOtpMsg({ type: '', text: '' });
        setRegisterOtpRequested(false);
        setRegisterOtpDigits(EMPTY_RESET_CODE_DIGITS);
        setRegisterForm((currentForm) => ({ ...currentForm, registrationOtp: '' }));

        try {
            const { data } = await requestRegisterOtp({
                email,
                full_name: registerForm.full_name.trim(),
            });
            const devCodeText = data.dev_code ? ` รหัสทดสอบ: ${data.dev_code}` : '';
            setRegisterOtpMsg({ type: 'success', text: `${data.message || 'ส่งรหัส OTP แล้ว'}${devCodeText}` });
            const now = Date.now();
            const expiresIn = Number(data.otp_expires_in) > 0 ? Number(data.otp_expires_in) : REGISTER_OTP_EXPIRES_SECONDS;
            setCurrentTime(now);
            setRegisterOtpExpiresAt(now + (expiresIn * 1000));
            setRegisterOtpCanResendAt(now + (REGISTER_OTP_RESEND_SECONDS * 1000));
            setRegisterOtpRequested(true);
            window.setTimeout(() => {
                registerOtpInputRefs.current[0]?.focus();
            }, 80);
        } catch (err) {
            setRegisterOtpMsg({ type: 'error', text: getRegisterOtpError(err, 'ส่งรหัส OTP ไม่สำเร็จ') });
        } finally {
            setIsRegisterOtpLoading(false);
        }
    };

    const handleVerifyRegisterOtp = async () => {
        const email = registerForm.email.trim();
        const code = String(registerForm.registrationOtp || '').trim();
        if (registerOtpExpiresAt && registerOtpRemainingSeconds <= 0) {
            setRegisterFieldErrors({ registrationOtp: 'รหัส OTP หมดอายุแล้ว กรุณาขอ OTP ใหม่' });
            setRegisterOtpMsg({ type: 'error', text: 'รหัส OTP หมดอายุแล้ว กรุณาขอ OTP ใหม่' });
            return;
        }
        if (!email || code.length !== 6) {
            setRegisterFieldErrors({ registrationOtp: 'กรุณากรอกรหัส OTP 6 หลักจากอีเมล' });
            setRegisterOtpMsg({ type: 'error', text: 'กรุณากรอกอีเมลและรหัส OTP 6 หลักให้ครบถ้วน' });
            return;
        }

        setIsRegisterOtpLoading(true);
        setRegisterOtpMsg({ type: '', text: '' });

        try {
            const { data } = await verifyRegisterOtp({ email, code });
            setIsRegisterOtpVerified(true);
            setRegisterStep('details');
            setRegisterOtpMsg({ type: 'success', text: data.message || 'ยืนยัน OTP สำเร็จ' });
            setRegisterFieldErrors((current) => {
                const nextErrors = { ...current };
                delete nextErrors.registrationOtp;
                return nextErrors;
            });
        } catch (err) {
            setIsRegisterOtpVerified(false);
            setRegisterOtpMsg({ type: 'error', text: getRegisterOtpError(err, 'รหัส OTP ไม่ถูกต้องหรือหมดอายุแล้ว') });
        } finally {
            setIsRegisterOtpLoading(false);
        }
    };

    const handleChangeRegisterEmail = () => {
        setRegisterStep('email');
        setIsRegisterOtpVerified(false);
        setRegisterOtpMsg({ type: '', text: '' });
        setRegisterOtpExpiresAt(null);
        setRegisterOtpCanResendAt(null);
        setRegisterOtpRequested(false);
        setRegisterOtpDigits(EMPTY_RESET_CODE_DIGITS);
        setRegisterForm((currentForm) => ({ ...currentForm, registrationOtp: '' }));
    };

    const handleRegisterFormSubmit = (event) => {
        if (registerStep !== 'details' || !isRegisterOtpVerified) {
            event.preventDefault();
            handleVerifyRegisterOtp();
            return;
        }

        onRegister(event);
    };

    const handleRequestResetCode = async (event) => {
        event.preventDefault();
        setIsForgotLoading(true);
        setForgotMsg({ type: '', text: '' });

        try {
            const { data } = await requestPasswordReset({
                email: forgotForm.email.trim(),
            });
            const devCodeText = data.dev_code ? ` รหัสทดสอบ: ${data.dev_code}` : '';
            setForgotMsg({ type: 'success', text: `${data.message || 'ส่งรหัสยืนยันแล้ว'}${devCodeText}` });
            setForgotCodeDigits(EMPTY_RESET_CODE_DIGITS);
            setForgotForm((currentForm) => ({ ...currentForm, code: '' }));
            setForgotStep('verify');
        } catch (err) {
            setForgotMsg({ type: 'error', text: getForgotError(err, 'ส่งรหัสยืนยันไม่สำเร็จ') });
        } finally {
            setIsForgotLoading(false);
        }
    };

    const handleVerifyResetCode = async (event) => {
        event.preventDefault();
        if (forgotCode.length !== 6) {
            setForgotMsg({ type: 'error', text: 'กรุณากรอกรหัสยืนยันให้ครบ 6 หลัก' });
            const firstEmptyIndex = forgotCodeDigits.findIndex((digit) => !digit);
            resetCodeInputRefs.current[firstEmptyIndex === -1 ? 5 : firstEmptyIndex]?.focus();
            return;
        }

        setIsForgotLoading(true);
        setForgotMsg({ type: '', text: '' });

        try {
            const { data } = await verifyPasswordResetCode({
                email: forgotForm.email.trim(),
                code: forgotCode,
            });
            setForgotMsg({ type: 'success', text: data.message || 'ยืนยันรหัสสำเร็จ' });
            setForgotStep('reset');
        } catch (err) {
            setForgotMsg({ type: 'error', text: getForgotError(err, 'รหัสยืนยันไม่ถูกต้องหรือหมดอายุแล้ว') });
        } finally {
            setIsForgotLoading(false);
        }
    };

    const setResetCodeAtIndex = (index, value) => {
        const cleanValue = value.replace(/\D/g, '').slice(0, 6);
        if (cleanValue.length > 1) {
            const nextDigits = [...forgotCodeDigits];
            cleanValue.split('').forEach((digit, offset) => {
                const nextIndex = index + offset;
                if (nextIndex < 6) nextDigits[nextIndex] = digit;
            });
            const nextCode = nextDigits.join('').slice(0, 6);
            setForgotCodeDigits(nextDigits);
            setForgotForm((currentForm) => ({ ...currentForm, code: nextCode }));
            setForgotMsg((message) => (message.type === 'error' ? { type: '', text: '' } : message));
            resetCodeInputRefs.current[Math.min(index + cleanValue.length, 5)]?.focus();
            return;
        }

        const digit = cleanValue;
        const nextDigits = [...forgotCodeDigits];
        nextDigits[index] = digit;
        const nextCode = nextDigits.join('').slice(0, 6);

        setForgotCodeDigits(nextDigits);
        setForgotForm((currentForm) => ({ ...currentForm, code: nextCode }));
        setForgotMsg((message) => (message.type === 'error' ? { type: '', text: '' } : message));

        if (digit && index < 5) {
            resetCodeInputRefs.current[index + 1]?.focus();
        }
    };

    const handleResetCodePaste = (event, index = 0) => {
        event.preventDefault();
        const pastedCode = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (!pastedCode) return;

        const nextDigits = [...forgotCodeDigits];
        pastedCode.split('').forEach((digit, offset) => {
            const nextIndex = index + offset;
            if (nextIndex < 6) nextDigits[nextIndex] = digit;
        });

        const nextCode = nextDigits.join('').slice(0, 6);
        setForgotCodeDigits(nextDigits);
        setForgotForm((currentForm) => ({ ...currentForm, code: nextCode }));
        setForgotMsg((message) => (message.type === 'error' ? { type: '', text: '' } : message));
        resetCodeInputRefs.current[Math.min(index + pastedCode.length, 5)]?.focus();
    };

    const handleResetCodeKeyDown = (event, index) => {
        if (event.key === 'Backspace' && !forgotCodeDigits[index] && index > 0) {
            resetCodeInputRefs.current[index - 1]?.focus();
        }
        if (event.key === 'ArrowLeft' && index > 0) {
            event.preventDefault();
            resetCodeInputRefs.current[index - 1]?.focus();
        }
        if (event.key === 'ArrowRight' && index < 5) {
            event.preventDefault();
            resetCodeInputRefs.current[index + 1]?.focus();
        }
    };

    const handleCompleteReset = async (event) => {
        event.preventDefault();
        if (forgotForm.password !== forgotForm.confirmPassword) {
            setForgotMsg({ type: 'error', text: 'กรุณายืนยันรหัสผ่านใหม่ให้ตรงกัน' });
            return;
        }

        setIsForgotLoading(true);
        setForgotMsg({ type: '', text: '' });

        try {
            const { data } = await resetPasswordWithCode({
                email: forgotForm.email.trim(),
                code: forgotCode,
                password: forgotForm.password,
            });
            setLoginForm({ ...loginForm, password: '' });
            setForgotMsg({ type: 'success', text: data.message || 'ตั้งรหัสผ่านใหม่สำเร็จ' });
            setForgotStep('done');
        } catch (err) {
            setForgotMsg({ type: 'error', text: getForgotError(err, 'ตั้งรหัสผ่านใหม่ไม่สำเร็จ') });
        } finally {
            setIsForgotLoading(false);
        }
    };

    return (
        <main className="auth-page">
            <section className="auth-shell">
                <div className="auth-visual">
                    <div className="auth-visual-top">
                        <div className="auth-brand-mark" aria-hidden="true">SL</div>
                        <span>SHOP LRU</span>
                    </div>
                    <div className="auth-hero-copy">
                        <p className="auth-kicker">SHOP LRU</p>
                        <h1>แฟชั่นที่เลือกง่าย จัดการร้านได้ครบ</h1>
                        <p className="auth-hero-description">
                            เลือกช้อปเสื้อผ้าดีไซน์ทันสมัย พร้อมระบบสั่งซื้อที่รวดเร็วและติดตามสถานะได้ในที่เดียว
                        </p>
                    </div>
                </div>

                <div className="auth-panel">
                    <div className="auth-panel-header">
                        <p>{isRegisterView ? 'เริ่มต้นใช้งาน' : 'ยินดีต้อนรับกลับ'}</p>
                        <h2>{isRegisterView ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}</h2>
                        <span>{isRegisterView ? 'สร้างบัญชีเพื่อเริ่มต้นช้อปสินค้า' : 'กรอกข้อมูลบัญชีเพื่อเข้าสู่ระบบอย่างรวดเร็ว'}</span>
                    </div>

                    <div className="auth-tabs" role="tablist" aria-label="เลือกหน้าฟอร์ม">
                        <button
                            type="button"
                            role="tab"
                            className={!isRegisterView ? 'active' : ''}
                            onClick={switchToLogin}
                            aria-selected={!isRegisterView}
                        >
                            เข้าสู่ระบบ
                        </button>
                        <button
                            type="button"
                            role="tab"
                            className={isRegisterView ? 'active' : ''}
                            onClick={switchToRegister}
                            aria-selected={isRegisterView}
                        >
                            สมัครสมาชิก
                        </button>
                    </div>

                    {isRegisterView ? (
                        <form className="auth-form" onSubmit={handleRegisterFormSubmit}>
                            {registerMsg.text && (
                                <div className={`auth-alert ${registerMsg.type === 'success' ? 'success' : 'error'}`}>
                                    {registerMsg.text}
                                </div>
                            )}

                            <div className="auth-register-steps" aria-label="ขั้นตอนสมัครสมาชิก">
                                <div className={registerStep === 'email' ? 'active' : 'done'}>
                                    <b>1</b>
                                    <em>ยืนยันตัวตน</em>
                                    <i aria-hidden="true">●</i>
                                </div>
                                <div className={registerStep === 'details' ? 'active' : ''}>
                                    <b>2</b>
                                    <em>ข้อมูลส่วนตัว</em>
                                    <i aria-hidden="true">○</i>
                                </div>
                            </div>

                            {registerStep === 'email' ? (
                                <>
                                    <label className={registerFieldErrors.email ? 'has-error' : ''}>
                                        อีเมล
                                        <input
                                            ref={setRegisterFieldRef('email')}
                                            type="email"
                                            placeholder="เช่น name@example.com"
                                            value={registerForm.email}
                                            onChange={(e) => handleRegisterFieldChange('email', e.target.value)}
                                            aria-invalid={Boolean(registerFieldErrors.email)}
                                            required
                                        />
                                    </label>

                                    {!registerOtpRequested ? (
                                        <>
                                            {registerOtpMsg.text && (
                                                <small className={`auth-register-otp-message ${registerOtpMsg.type === 'success' ? 'success' : 'error'}`}>
                                                    {registerOtpMsg.text}
                                                </small>
                                            )}
                                            <button
                                                type="button"
                                                className="auth-submit"
                                                onClick={handleRequestRegisterOtp}
                                                disabled={isRegisterOtpLoading}
                                            >
                                                {isRegisterOtpLoading ? 'กำลังส่ง OTP...' : 'ส่งรหัส OTP'}
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <section className={`auth-register-otp ${registerFieldErrors.registrationOtp ? 'has-error' : ''}`}>
                                                <div className="auth-register-otp-head">
                                                    <label htmlFor="register-otp">รหัส OTP จากอีเมล</label>
                                                    {isRegisterOtpVerified && <span>ยืนยันแล้ว</span>}
                                                </div>
                                                <div className="auth-register-otp-row">
                                                    <div className="auth-register-otp-inputs" aria-label="กรอกรหัส OTP 6 หลัก">
                                                        {registerOtpDigits.map((digit, index) => (
                                                            <input
                                                                ref={(element) => {
                                                                    registerOtpInputRefs.current[index] = element;
                                                                    if (index === 0) setRegisterFieldRef('registrationOtp')(element);
                                                                }}
                                                                id={index === 0 ? 'register-otp' : undefined}
                                                                key={index}
                                                                type="text"
                                                                inputMode="numeric"
                                                                pattern="[0-9]*"
                                                                maxLength="1"
                                                                value={digit}
                                                                onChange={(event) => setRegisterOtpAtIndex(index, event.target.value)}
                                                                onPaste={handleRegisterOtpPaste}
                                                                onFocus={() => handleRegisterOtpFocus(index)}
                                                                onKeyDown={(event) => handleRegisterOtpKeyDown(event, index)}
                                                                aria-label={`รหัส OTP หลักที่ ${index + 1}`}
                                                                aria-invalid={Boolean(registerFieldErrors.registrationOtp)}
                                                                required
                                                            />
                                                        ))}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={handleRequestRegisterOtp}
                                                        disabled={isRegisterOtpLoading || registerOtpResendSeconds > 0}
                                                    >
                                                        {registerOtpResendSeconds > 0 ? `ขอใหม่ใน ${registerOtpResendSeconds}s` : registerOtpRequestLabel}
                                                    </button>
                                                </div>
                                                {registerOtpExpiresAt && (
                                                    <div className={`auth-register-otp-timer ${hasActiveRegisterOtp ? '' : 'expired'}`}>
                                                        {hasActiveRegisterOtp
                                                            ? `รหัส OTP จะหมดอายุใน ${formatOtpTime(registerOtpRemainingSeconds)}`
                                                            : 'รหัส OTP หมดอายุแล้ว กรุณาขอ OTP ใหม่'}
                                                    </div>
                                                )}
                                                {registerOtpMsg.text && (
                                                    <small className={`auth-register-otp-message ${registerOtpMsg.type === 'success' ? 'success' : 'error'}`}>
                                                        {registerOtpMsg.text}
                                                    </small>
                                                )}
                                            </section>

                                            <button
                                                type="submit"
                                                className="auth-submit"
                                                disabled={isRegisterOtpLoading || !hasActiveRegisterOtp || String(registerForm.registrationOtp || '').length !== 6}
                                            >
                                                {isRegisterOtpLoading ? 'กำลังตรวจ OTP...' : 'ยืนยันอีเมล'}
                                            </button>
                                        </>
                                    )}
                                </>
                            ) : (
                                <>
                                    <section className="auth-verified-email">
                                        <div>
                                            <span>อีเมลที่ยืนยันแล้ว</span>
                                            <strong>{registerForm.email}</strong>
                                        </div>
                                        <button type="button" onClick={handleChangeRegisterEmail}>เปลี่ยนอีเมล</button>
                                    </section>

                                    <label className={registerFieldErrors.full_name ? 'has-error' : ''}>
                                        ชื่อ-นามสกุล
                                        <input
                                            ref={setRegisterFieldRef('full_name')}
                                            type="text"
                                            placeholder="กรอกชื่อสำหรับติดต่อ"
                                            value={registerForm.full_name}
                                            onChange={(e) => handleRegisterFieldChange('full_name', e.target.value)}
                                            aria-invalid={Boolean(registerFieldErrors.full_name)}
                                            required
                                        />
                                    </label>

                                    <label className={registerFieldErrors.password ? 'has-error' : ''}>
                                        รหัสผ่าน
                                        <input
                                            ref={setRegisterFieldRef('password')}
                                            type="password"
                                            placeholder="ตั้งรหัสผ่าน"
                                            value={registerForm.password}
                                            onChange={(e) => handleRegisterFieldChange('password', e.target.value)}
                                            minLength="8"
                                            aria-invalid={Boolean(registerFieldErrors.password)}
                                            required
                                        />
                                    </label>

                                    <label className={registerFieldErrors.confirmPassword ? 'has-error' : ''}>
                                        ยืนยันรหัสผ่าน
                                        <input
                                            ref={setRegisterFieldRef('confirmPassword')}
                                            type="password"
                                            placeholder="กรอกรหัสผ่านอีกครั้ง"
                                            value={registerForm.confirmPassword}
                                            onChange={(e) => handleRegisterFieldChange('confirmPassword', e.target.value)}
                                            minLength="8"
                                            aria-invalid={Boolean(registerFieldErrors.confirmPassword)}
                                            required
                                        />
                                    </label>

                                    <label className={registerFieldErrors.phone ? 'has-error' : ''}>
                                        เบอร์โทรศัพท์
                                        <input
                                            ref={setRegisterFieldRef('phone')}
                                            type="tel"
                                            placeholder="เบอร์โทรสำหรับติดต่อ"
                                            value={registerForm.phone}
                                            onChange={(e) => handleRegisterFieldChange('phone', e.target.value)}
                                            aria-invalid={Boolean(registerFieldErrors.phone)}
                                            required
                                        />
                                    </label>

                                    <section className="auth-register-address" aria-labelledby="register-address-title">
                                        <div className="auth-register-address-head">
                                            <span id="register-address-title">ที่อยู่</span>
                                            {isThaiAddressLoading && <small>กำลังโหลดข้อมูลพื้นที่...</small>}
                                        </div>
                                        <label className={registerFieldErrors.address_detail ? 'has-error' : ''}>
                                            บ้านเลขที่ / รายละเอียดที่อยู่
                                            <textarea
                                                ref={setRegisterFieldRef('address_detail')}
                                                placeholder="บ้านเลขที่ อาคาร ถนน หรือจุดสังเกต"
                                                value={registerForm.address_detail || ''}
                                                onChange={(e) => handleRegisterFieldChange('address_detail', e.target.value)}
                                                aria-invalid={Boolean(registerFieldErrors.address_detail)}
                                                required
                                            />
                                        </label>
                                        <div className="auth-register-address-grid">
                                            <label className={registerFieldErrors.province ? 'has-error' : ''}>
                                                จังหวัด
                                                <select
                                                    ref={setRegisterFieldRef('province')}
                                                    value={registerForm.province || ''}
                                                    onChange={(e) => handleRegisterProvinceChange(e.target.value)}
                                                    aria-invalid={Boolean(registerFieldErrors.province)}
                                                    required
                                                >
                                                    <option value="">เลือกจังหวัด</option>
                                                    {thaiAddressData.provinces.map((province) => (
                                                        <option key={province.id} value={getName(province)}>{getName(province)}</option>
                                                    ))}
                                                </select>
                                            </label>
                                            <label className={registerFieldErrors.district ? 'has-error' : ''}>
                                                อำเภอ/เขต
                                                <select
                                                    ref={setRegisterFieldRef('district')}
                                                    value={registerForm.district || ''}
                                                    onChange={(e) => handleRegisterDistrictChange(e.target.value)}
                                                    aria-invalid={Boolean(registerFieldErrors.district)}
                                                    required
                                                >
                                                    <option value="">เลือกอำเภอ/เขต</option>
                                                    {districtChoices.map((district) => (
                                                        <option key={district.id} value={getName(district)}>{getName(district)}</option>
                                                    ))}
                                                </select>
                                            </label>
                                            <label className={registerFieldErrors.subdistrict ? 'has-error' : ''}>
                                                ตำบล/แขวง
                                                <select
                                                    ref={setRegisterFieldRef('subdistrict')}
                                                    value={registerForm.subdistrict || ''}
                                                    onChange={(e) => handleRegisterSubDistrictChange(e.target.value)}
                                                    aria-invalid={Boolean(registerFieldErrors.subdistrict)}
                                                    required
                                                >
                                                    <option value="">เลือกตำบล/แขวง</option>
                                                    {subDistrictChoices.map((subDistrict) => (
                                                        <option key={subDistrict.id} value={getName(subDistrict)}>{getName(subDistrict)}</option>
                                                    ))}
                                                </select>
                                            </label>
                                            <label className={registerFieldErrors.postal_code ? 'has-error' : ''}>
                                                รหัสไปรษณีย์
                                                <select
                                                    ref={setRegisterFieldRef('postal_code')}
                                                    value={registerForm.postal_code || ''}
                                                    onChange={(e) => handleRegisterFieldChange('postal_code', e.target.value)}
                                                    aria-invalid={Boolean(registerFieldErrors.postal_code)}
                                                    required
                                                >
                                                    <option value="">เลือกรหัสไปรษณีย์</option>
                                                    {postalCodeChoices.map((postalCode) => (
                                                        <option key={postalCode} value={postalCode}>{postalCode}</option>
                                                    ))}
                                                </select>
                                            </label>
                                        </div>
                                    </section>

                                    <section
                                        ref={setRegisterFieldRef('privacyNoticeAcknowledged')}
                                        className={`auth-privacy-summary ${registerFieldErrors.privacyNoticeAcknowledged ? 'has-error' : ''}`}
                                        aria-labelledby="auth-privacy-summary-title"
                                    >
                                        <div className="auth-privacy-summary-header">
                                            <h3 id="auth-privacy-summary-title">Privacy Policy / นโยบายความเป็นส่วนตัว</h3>
                                            <p>ข้อมูลที่คุณกรอกจะถูกใช้เท่าที่จำเป็นต่อการสมัครบัญชี การสั่งซื้อ และการให้บริการของร้านค้า</p>
                                        </div>
                                        <button
                                            type="button"
                                            className={`auth-privacy-open ${registerForm.privacyNoticeAcknowledged ? 'accepted' : ''}`}
                                            onClick={openPrivacyNotice}
                                        >
                                            {registerForm.privacyNoticeAcknowledged ? 'อ่านและรับทราบนโยบายความเป็นส่วนตัวแล้ว' : 'อ่านและรับทราบนโยบายความเป็นส่วนตัว'}
                                        </button>
                                    </section>

                                    <section className="auth-consent-box" aria-labelledby="consent-analytics-title">
                                        <label
                                            className={`auth-consent-row ${!registerForm.privacyNoticeAcknowledged ? 'disabled' : ''}`}
                                            onClick={requestPrivacyBeforeConsent}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={registerForm.consentAnalytics}
                                                disabled={!registerForm.privacyNoticeAcknowledged}
                                                onChange={handleConsentChange}
                                            />
                                            <span>
                                                <strong id="consent-analytics-title">ยินยอมการประมวลผลข้อมูลส่วนบุคคล</strong>
                                                <small>กรุณาอ่านและรับทราบนโยบายความเป็นส่วนตัวด้านบนก่อนเลือกความยินยอม</small>
                                            </span>
                                        </label>
                                        {consentNotice && <small className="auth-consent-warning">{consentNotice}</small>}
                                    </section>

                                    <section
                                        ref={setRegisterFieldRef('termsAccepted')}
                                        className={`auth-terms-box ${registerFieldErrors.termsAccepted ? 'has-error' : ''}`}
                                    >
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={Boolean(registerForm.termsAccepted)}
                                                onChange={(e) => handleRegisterFieldChange('termsAccepted', e.target.checked)}
                                            />
                                            <span>
                                                <strong>ข้อกำหนดการใช้งาน</strong>
                                                <small>ยอมรับการใช้งานระบบสั่งซื้อ การชำระเงิน การจัดส่ง และการติดต่อจากร้านค้า</small>
                                            </span>
                                        </label>
                                    </section>

                                    <button type="submit" className="auth-submit">สร้างบัญชี</button>
                                </>
                            )}
                        </form>
                    ) : (
                        <form className="auth-form" onSubmit={onLogin}>
                            {loginError && <div className="auth-alert error">{loginError}</div>}

                            <label htmlFor="login-username">
                                ชื่อผู้ใช้หรืออีเมล
                                <input
                                    id="login-username"
                                    type="text"
                                    placeholder="กรอกชื่อผู้ใช้หรืออีเมล"
                                    value={loginForm.username}
                                    onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                                    autoComplete="username"
                                    required
                                />
                            </label>

                            <label htmlFor="login-password">
                                รหัสผ่าน
                                <div className="auth-password-field">
                                    <input
                                        id="login-password"
                                        type={showLoginPassword ? 'text' : 'password'}
                                        placeholder="กรอกรหัสผ่าน"
                                        value={loginForm.password}
                                        onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                                        autoComplete="current-password"
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="auth-password-toggle"
                                        onClick={() => setShowLoginPassword((visible) => !visible)}
                                        aria-label={showLoginPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                                        aria-pressed={showLoginPassword}
                                    >
                                        {showLoginPassword ? (
                                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.7a2 2 0 002.7 2.7M9.9 4.2A10.8 10.8 0 0112 4c5.5 0 9 5.5 9 5.5a15.4 15.4 0 01-2.1 2.7M6.6 6.7C4.3 8.2 3 10 3 10s3.5 5.5 9 5.5c1.2 0 2.3-.3 3.3-.7" /></svg>
                                        ) : (
                                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.5-5.5 9-5.5 9 5.5 9 5.5-3.5 5.5-9 5.5S3 12 3 12z" /><circle cx="12" cy="12" r="2.5" /></svg>
                                        )}
                                    </button>
                                </div>
                            </label>

                            <div className="auth-login-options">
                                <label className="auth-remember">
                                    <input
                                        type="checkbox"
                                        checked={rememberLogin}
                                        onChange={(e) => setRememberLogin(e.target.checked)}
                                    />
                                    <span>จดจำรหัส</span>
                                </label>
                                <button type="button" className="auth-forgot" onClick={openForgotPassword}>
                                    ลืมรหัสผ่าน?
                                </button>
                            </div>

                            <button type="submit" className="auth-submit" disabled={isLoginLoading}>
                                {isLoginLoading && <span className="auth-submit-spinner" aria-hidden="true"></span>}
                                {isLoginLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
                            </button>
                        </form>
                    )}
                </div>
            </section>

            {showPrivacyNotice && (
                <div className="auth-privacy-modal-backdrop" role="presentation">
                    <section
                        className="auth-privacy-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="privacy-notice-modal-title"
                    >
                        <header>
                            <div>
                                <span>Privacy Policy</span>
                                <h3 id="privacy-notice-modal-title">Privacy Policy / นโยบายความเป็นส่วนตัว</h3>
                                <p>กรุณาเลื่อนอ่านเนื้อหาจนสุดก่อนกดรับทราบ</p>
                            </div>
                            <button type="button" onClick={() => setShowPrivacyNotice(false)} aria-label="ปิด Privacy Policy / นโยบายความเป็นส่วนตัว">
                                ×
                            </button>
                        </header>
                        <div className="auth-privacy-modal-scroll" tabIndex="0" onScroll={handlePrivacyScroll}>
                            {PRIVACY_NOTICE_SECTIONS.map((section) => (
                                <article key={section.title}>
                                    <h4>{section.title}</h4>
                                    <p>{section.text}</p>
                                </article>
                            ))}
                        </div>
                        <footer>
                            {!hasScrolledPrivacyNotice && (
                                <small>เลื่อนอ่าน Privacy Policy / นโยบายความเป็นส่วนตัวให้ถึงท้ายเอกสารก่อน</small>
                            )}
                            <button type="button" onClick={acknowledgePrivacyNotice} disabled={!hasScrolledPrivacyNotice}>
                                รับทราบ
                            </button>
                        </footer>
                    </section>
                </div>
            )}

            {showForgotPassword && (
                <div className="auth-forgot-backdrop" role="presentation" onMouseDown={(event) => {
                    if (event.target === event.currentTarget) closeForgotPassword();
                }}>
                    <section className="auth-forgot-dialog" role="dialog" aria-modal="true" aria-labelledby="forgot-password-title">
                        <button type="button" className="auth-forgot-close" onClick={closeForgotPassword} aria-label="ปิด">×</button>
                        <div className="auth-forgot-icon" aria-hidden="true">?</div>
                        <h3 id="forgot-password-title">ลืมรหัสผ่าน</h3>
                        <p>
                            {forgotStep === 'request' && 'กรอกอีเมลที่ลงทะเบียนไว้ ระบบจะส่งรหัสยืนยัน 6 หลักไปทางอีเมล'}
                            {forgotStep === 'verify' && 'กรอกรหัสยืนยัน 6 หลักจากอีเมล รหัสจะหมดอายุภายใน 10 นาที'}
                            {forgotStep === 'reset' && 'ตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ'}
                            {forgotStep === 'done' && 'รีเซ็ตรหัสผ่านเรียบร้อยแล้ว คุณสามารถกลับไปเข้าสู่ระบบด้วยรหัสใหม่ได้ทันที'}
                        </p>

                        {forgotMsg.text && (
                            <div className={`auth-alert ${forgotMsg.type === 'success' ? 'success' : 'error'}`}>
                                {forgotMsg.text}
                            </div>
                        )}

                        {forgotStep === 'request' && (
                            <form className="auth-forgot-form" onSubmit={handleRequestResetCode}>
                                <label>
                                    อีเมล
                                    <input
                                        type="email"
                                        value={forgotForm.email}
                                        onChange={(e) => setForgotForm({ ...forgotForm, email: e.target.value })}
                                        placeholder="name@example.com"
                                        autoComplete="email"
                                        required
                                    />
                                </label>
                                <button type="submit" className="auth-submit" disabled={isForgotLoading}>
                                    {isForgotLoading ? 'กำลังส่งรหัส...' : 'ส่งรหัสยืนยันทางอีเมล'}
                                </button>
                            </form>
                        )}

                        {forgotStep === 'verify' && (
                            <form className="auth-forgot-form" onSubmit={handleVerifyResetCode}>
                                <fieldset className="auth-code-fieldset">
                                    <legend>รหัสยืนยัน</legend>
                                    <div className="auth-code-inputs" aria-label="กรอกรหัสยืนยัน 6 หลัก">
                                        {forgotCodeDigits.map((digit, index) => (
                                            <input
                                                key={index}
                                                ref={(element) => {
                                                    resetCodeInputRefs.current[index] = element;
                                                }}
                                                type="text"
                                                inputMode="numeric"
                                                maxLength="1"
                                                value={digit.trim()}
                                                onChange={(event) => setResetCodeAtIndex(index, event.target.value)}
                                                onKeyDown={(event) => handleResetCodeKeyDown(event, index)}
                                                onPaste={(event) => handleResetCodePaste(event, index)}
                                                onFocus={(event) => event.target.select()}
                                                autoComplete={index === 0 ? 'one-time-code' : 'off'}
                                                aria-label={`รหัสหลักที่ ${index + 1}`}
                                            />
                                        ))}
                                    </div>
                                </fieldset>
                                <button type="submit" className="auth-submit" disabled={isForgotLoading || forgotCode.length !== 6}>
                                    {isForgotLoading ? 'กำลังตรวจสอบ...' : 'ยืนยันรหัส'}
                                </button>
                                <button type="button" className="auth-forgot-secondary" onClick={handleRequestResetCode} disabled={isForgotLoading}>
                                    ส่งรหัสอีกครั้ง
                                </button>
                            </form>
                        )}

                        {forgotStep === 'reset' && (
                            <form className="auth-forgot-form" onSubmit={handleCompleteReset}>
                                <label>
                                    รหัสผ่านใหม่
                                    <input
                                        type="password"
                                        value={forgotForm.password}
                                        onChange={(e) => setForgotForm({ ...forgotForm, password: e.target.value })}
                                        placeholder="อย่างน้อย 8 ตัวอักษร"
                                        autoComplete="new-password"
                                        minLength="8"
                                        required
                                    />
                                </label>
                                <label>
                                    ยืนยันรหัสผ่านใหม่
                                    <input
                                        type="password"
                                        value={forgotForm.confirmPassword}
                                        onChange={(e) => setForgotForm({ ...forgotForm, confirmPassword: e.target.value })}
                                        placeholder="กรอกรหัสผ่านอีกครั้ง"
                                        autoComplete="new-password"
                                        minLength="8"
                                        required
                                    />
                                </label>
                                <button type="submit" className="auth-submit" disabled={isForgotLoading}>
                                    {isForgotLoading ? 'กำลังบันทึก...' : 'ตั้งรหัสผ่านใหม่'}
                                </button>
                            </form>
                        )}

                        {forgotStep === 'done' && (
                            <button type="button" className="auth-submit" onClick={closeForgotPassword}>กลับไปเข้าสู่ระบบ</button>
                        )}
                    </section>
                </div>
            )}
        </main>
    );
}

export default AuthPage;
