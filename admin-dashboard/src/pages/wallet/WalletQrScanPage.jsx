import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Html5Qrcode } from 'html5-qrcode';
import { ArrowLeft, AlertCircle, CheckCircle2, Camera, Loader2, UserCircle } from 'lucide-react';
import { parseStudentWalletQr } from '../../utils/studentWalletQr';
import { studentsAPI } from '../../services/api';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import './WalletQrScanPage.css';

/** html5-qrcode throws synchronously if stop() when not scanning (Strict Mode / race). */
function safeStopHtml5(html5) {
  if (!html5) return Promise.resolve();
  try {
    const out = html5.stop();
    return out && typeof out.then === 'function' ? out.catch(() => {}) : Promise.resolve();
  } catch {
    return Promise.resolve();
  }
}

/**
 * Full main-content page: camera scan + wallet operation (replaces modal).
 */
const WalletQrScanPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const scannerElementId = `wallet-qr-scanner-${useId().replace(/:/g, '')}`;
  const [walletType, setWalletType] = useState('deposit');
  const [amount, setAmount] = useState('');
  const [scannedStudentId, setScannedStudentId] = useState(null);
  const [scanError, setScanError] = useState('');
  const [applyError, setApplyError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(true);
  const [scannedStudent, setScannedStudent] = useState(null);
  const [studentInfoLoading, setStudentInfoLoading] = useState(false);
  const [studentInfoError, setStudentInfoError] = useState(false);
  const html5Ref = useRef(null);

  const scannedAvatarSrc = useMemo(
    () => (scannedStudent ? resolveMediaUrl(scannedStudent.image_url) : null),
    [scannedStudent],
  );

  useEffect(() => {
    if (!scannedStudentId) {
      setScannedStudent(null);
      setStudentInfoError(false);
      setStudentInfoLoading(false);
      return;
    }
    let cancelled = false;
    setStudentInfoLoading(true);
    setStudentInfoError(false);
    studentsAPI
      .walletQrPreview(scannedStudentId)
      .then((data) => {
        if (!cancelled) {
          setScannedStudent(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setScannedStudent(null);
          setStudentInfoError(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setStudentInfoLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [scannedStudentId]);

  useEffect(() => {
    if (scannedStudentId !== null) return undefined;

    let cancelled = false;

    const run = async () => {
      if (cancelled) return;
      setScanError('');
      setCameraLoading(true);

      try {
        const html5 = new Html5Qrcode(scannerElementId);
        html5Ref.current = html5;
        await html5.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            aspectRatio: 1.3333334,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const edge = Math.min(viewfinderWidth, viewfinderHeight);
              const size = Math.max(180, Math.floor(edge * 0.68));
              return { width: size, height: size };
            },
          },
          (decodedText) => {
            const parsed = parseStudentWalletQr(decodedText);
            if (!parsed) {
              setScanError(t('students.qrScanInvalid'));
              return;
            }
            setScannedStudentId(parsed.studentId);
            setScanError('');
          },
          () => {},
        );
        if (cancelled) {
          await safeStopHtml5(html5);
          return;
        }
        setCameraLoading(false);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setScanError(t('students.qrCameraError'));
          setCameraLoading(false);
        }
        html5Ref.current = null;
      }
    };

    const scheduleId = window.setTimeout(() => {
      void run();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(scheduleId);
      const h = html5Ref.current;
      html5Ref.current = null;
      void safeStopHtml5(h);
    };
  }, [scannedStudentId, scannerElementId, t]);

  const handleRescan = () => {
    setScannedStudentId(null);
    setScannedStudent(null);
    setStudentInfoError(false);
    setScanError('');
  };

  const handleCancel = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const handleApply = async (e) => {
    e.preventDefault();
    setApplyError('');
    if (!scannedStudentId) {
      setApplyError(t('students.qrScanFirst'));
      return;
    }
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setApplyError(t('students.qrAmountInvalid'));
      return;
    }
    try {
      setSubmitting(true);
      await studentsAPI.updateWallet(scannedStudentId, {
        type: walletType,
        amount: n,
      });
      navigate(`/students/${scannedStudentId}?wallet=1`);
    } catch (err) {
      console.error(err);
      setApplyError(err.response?.data?.message || t('students.qrApplyError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="wallet-qr-page">
      <header className="wallet-qr-page-header">
        <Button type="button" variant="outline" onClick={handleCancel} className="wallet-qr-page-back">
          <ArrowLeft size={18} />
          {t('common.back')}
        </Button>
        <div className="wallet-qr-page-heading">
          <h1 className="page-title">{t('students.scanWalletQr')}</h1>
          <p className="page-subtitle">{t('students.scanWalletQrHint')}</p>
        </div>
      </header>

      <form className="wallet-qr-page-form" onSubmit={handleApply}>
        <div className="wallet-qr-page-grid">
          <section className="wallet-qr-page-camera-panel" aria-labelledby="wallet-qr-camera-heading">
            <div className="wallet-qr-scan-head">
              <h2 id="wallet-qr-camera-heading" className="wallet-qr-scan-title wallet-qr-scan-title--page">
                {t('students.qrScanArea')}
              </h2>
              {scannedStudentId !== null && (
                <button type="button" className="wallet-qr-rescan-link" onClick={handleRescan}>
                  {t('students.rescanQr')}
                </button>
              )}
            </div>

            {scannedStudentId !== null ? (
              <div className="wallet-qr-scanned-banner wallet-qr-scanned-banner--detail">
                {studentInfoLoading ? (
                  <div className="wallet-qr-student-loading">
                    <Loader2 className="wallet-qr-student-loading-spin" size={28} />
                    <span>{t('students.qrStudentInfoLoading')}</span>
                  </div>
                ) : (
                  <>
                    <div className="wallet-qr-student-avatar-wrap">
                      {scannedAvatarSrc ? (
                        <img src={scannedAvatarSrc} alt="" className="wallet-qr-student-avatar" />
                      ) : (
                        <div className="wallet-qr-student-avatar wallet-qr-student-avatar--placeholder">
                          <UserCircle size={40} strokeWidth={1.25} />
                        </div>
                      )}
                    </div>
                    <div className="wallet-qr-student-info">
                      <div className="wallet-qr-scanned-label">{t('students.studentScanned')}</div>
                      {studentInfoError || !scannedStudent ? (
                        <p className="wallet-qr-student-fallback">
                          {t('students.qrStudentLoadError')} · ID: {scannedStudentId}
                        </p>
                      ) : (
                        <>
                          <p className="wallet-qr-student-name">{scannedStudent.full_name || '—'}</p>
                          <dl className="wallet-qr-student-meta">
                            <div>
                              <dt>{t('students.email')}</dt>
                              <dd>{scannedStudent.email || '—'}</dd>
                            </div>
                            <div>
                              <dt>{t('students.phone')}</dt>
                              <dd>{scannedStudent.phone || '—'}</dd>
                            </div>
                            <div>
                              <dt>{t('students.qrCurrentBalance')}</dt>
                              <dd>{scannedStudent.wallet?.balance ?? '—'}</dd>
                            </div>
                          </dl>
                          <Link to={`/students/${scannedStudentId}`} className="wallet-qr-student-profile-link">
                            {t('students.studentDetails')} →
                          </Link>
                        </>
                      )}
                    </div>
                    <CheckCircle2 size={22} className="wallet-qr-scanned-icon wallet-qr-scanned-icon--corner" aria-hidden />
                  </>
                )}
              </div>
            ) : (
              <>
                {scanError && (
                  <div className="wallet-qr-modal-error wallet-qr-modal-error--compact" role="alert">
                    <AlertCircle size={18} />
                    <span>{scanError}</span>
                  </div>
                )}
                <div className="wallet-qr-camera-shell wallet-qr-camera-shell--page">
                  {cameraLoading && (
                    <div className="wallet-qr-camera-loading" aria-live="polite">
                      <Camera size={36} strokeWidth={1.25} className="wallet-qr-camera-loading-icon" />
                      <span>{t('students.qrCameraStarting')}</span>
                    </div>
                  )}
                  <div id={scannerElementId} className="wallet-qr-scanner-host" />
                  <div className="wallet-qr-viewfinder" aria-hidden="true">
                    <span className="wallet-qr-viewfinder-corner wallet-qr-viewfinder-corner--tl" />
                    <span className="wallet-qr-viewfinder-corner wallet-qr-viewfinder-corner--tr" />
                    <span className="wallet-qr-viewfinder-corner wallet-qr-viewfinder-corner--bl" />
                    <span className="wallet-qr-viewfinder-corner wallet-qr-viewfinder-corner--br" />
                  </div>
                </div>
              </>
            )}
          </section>

          <aside className="wallet-qr-page-side-panel">
            <div className="wallet-qr-form-row wallet-qr-form-row--page">
              <div className="wallet-qr-field">
                <label className="input-label">{t('students.qrOperationType')}</label>
                <select
                  className="input-field"
                  value={walletType}
                  onChange={(e) => setWalletType(e.target.value)}
                >
                  <option value="deposit">{t('students.qrDeposit')}</option>
                  <option value="withdraw">{t('students.qrWithdraw')}</option>
                </select>
              </div>
              <div className="wallet-qr-field wallet-qr-field--grow">
                <label className="input-label">{t('students.qrAmountLabel')}</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  fullWidth
                />
              </div>
            </div>

            {applyError && (
              <div className="wallet-qr-modal-error wallet-qr-modal-error--page" role="alert">
                <AlertCircle size={18} />
                <span>{applyError}</span>
              </div>
            )}

            <div className="wallet-qr-page-actions">
              <Button type="button" variant="outline" onClick={handleCancel}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" loading={submitting} disabled={!scannedStudentId}>
                {t('students.applyWalletQr')}
              </Button>
            </div>
          </aside>
        </div>
      </form>
    </div>
  );
};

export default WalletQrScanPage;
