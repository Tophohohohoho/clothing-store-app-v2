import { useEffect, useRef, useState } from 'react';

const NOTIFY_EVENT = 'app-notify';
const CONFIRM_EVENT = 'app-confirm';
const ALERT_EVENT = 'app-alert';

export const notify = ({ type = 'success', title, message = '', duration = 3000 } = {}) => {
    window.dispatchEvent(new CustomEvent(NOTIFY_EVENT, {
        detail: {
            id: `${Date.now()}-${Math.random()}`,
            type,
            title,
            message,
            duration,
        },
    }));
};

export const confirmNotification = ({
    title = 'ยืนยันการทำรายการ',
    message = '',
    confirmText = 'ตกลง',
    cancelText = 'ยกเลิก',
    type = 'warning',
} = {}) => new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent(CONFIRM_EVENT, {
        detail: {
            title,
            message,
            confirmText,
            cancelText,
            type,
            resolve,
        },
    }));
});

export const alertNotification = ({
    title = 'แจ้งเตือน',
    message = '',
    buttonText = 'รับทราบ',
    type = 'warning',
} = {}) => new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent(ALERT_EVENT, {
        detail: {
            title,
            message,
            buttonText,
            type,
            resolve,
        },
    }));
});

function AppNotificationHost() {
    const [toasts, setToasts] = useState([]);
    const [confirmState, setConfirmState] = useState(null);
    const [alertState, setAlertState] = useState(null);
    const timersRef = useRef(new Map());

    useEffect(() => {
        const activeTimers = timersRef.current;
        const handleNotify = (event) => {
            const toast = event.detail;
            setToasts((current) => [...current, toast]);
            const timer = window.setTimeout(() => {
                setToasts((current) => current.filter((item) => item.id !== toast.id));
                activeTimers.delete(toast.id);
            }, toast.duration);
            activeTimers.set(toast.id, timer);
        };

        const handleConfirm = (event) => {
            setConfirmState(event.detail);
        };

        const handleAlert = (event) => {
            setAlertState(event.detail);
        };

        window.addEventListener(NOTIFY_EVENT, handleNotify);
        window.addEventListener(CONFIRM_EVENT, handleConfirm);
        window.addEventListener(ALERT_EVENT, handleAlert);
        return () => {
            window.removeEventListener(NOTIFY_EVENT, handleNotify);
            window.removeEventListener(CONFIRM_EVENT, handleConfirm);
            window.removeEventListener(ALERT_EVENT, handleAlert);
            activeTimers.forEach((timer) => window.clearTimeout(timer));
            activeTimers.clear();
        };
    }, []);

    const dismissToast = (toastId) => {
        const timer = timersRef.current.get(toastId);
        if (timer) window.clearTimeout(timer);
        timersRef.current.delete(toastId);
        setToasts((current) => current.filter((item) => item.id !== toastId));
    };

    const closeConfirm = (result) => {
        confirmState?.resolve?.(result);
        setConfirmState(null);
    };

    const closeAlert = () => {
        alertState?.resolve?.(true);
        setAlertState(null);
    };

    return (
        <>
            <div className="app-toast-stack" aria-live="polite" aria-relevant="additions removals">
                {toasts.map((toast) => (
                    <article className={`app-toast ${toast.type}`} key={toast.id}>
                        <div className="app-toast-icon" aria-hidden="true">
                            {toast.type === 'success' ? '✓' : toast.type === 'error' ? '!' : 'i'}
                        </div>
                        <div>
                            <strong>{toast.title || (toast.type === 'success' ? 'สำเร็จ' : toast.type === 'error' ? 'ไม่สำเร็จ' : 'แจ้งเตือน')}</strong>
                            {toast.message && <span>{toast.message}</span>}
                        </div>
                        <button type="button" onClick={() => dismissToast(toast.id)} aria-label="ปิดการแจ้งเตือน">×</button>
                    </article>
                ))}
            </div>

            {confirmState && (
                <div className="app-confirm-backdrop" role="presentation" onMouseDown={() => closeConfirm(false)}>
                    <section
                        className={`app-confirm-dialog ${confirmState.type || 'warning'}`}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="app-confirm-title"
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        <div className="app-confirm-icon" aria-hidden="true">
                            {confirmState.type === 'danger' ? '!' : '✓'}
                        </div>
                        <div>
                            <h2 id="app-confirm-title">{confirmState.title}</h2>
                            {confirmState.message && <p>{confirmState.message}</p>}
                        </div>
                        <div className="app-confirm-actions">
                            <button type="button" className="secondary" onClick={() => closeConfirm(false)}>
                                {confirmState.cancelText}
                            </button>
                            <button type="button" className="primary" onClick={() => closeConfirm(true)}>
                                {confirmState.confirmText}
                            </button>
                        </div>
                    </section>
                </div>
            )}

            {alertState && (
                <div className="app-confirm-backdrop" role="presentation" onMouseDown={closeAlert}>
                    <section
                        className={`app-confirm-dialog app-alert-dialog ${alertState.type || 'warning'}`}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="app-alert-title"
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        <button type="button" className="app-alert-close" onClick={closeAlert} aria-label="ปิดการแจ้งเตือน">
                            ×
                        </button>
                        <div className="app-confirm-icon" aria-hidden="true">
                            {alertState.type === 'error' || alertState.type === 'danger' ? '!' : 'i'}
                        </div>
                        <div>
                            <h2 id="app-alert-title">{alertState.title}</h2>
                            {alertState.message && <p>{alertState.message}</p>}
                        </div>
                    </section>
                </div>
            )}
        </>
    );
}

export default AppNotificationHost;
