import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function ShareModal({ game, onClose }) {
  const link = `${window.location.origin}${window.location.pathname}#/g/${game.code}`;
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => { QRCode.toDataURL(link, { width: 260, margin: 1 }).then(setQr).catch(() => {}); }, [link]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { window.prompt('Copy this link', link); }
  };

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal stack" onClick={(e) => e.stopPropagation()}>
        <h2>Share live stats</h2>
        <p className="muted">Anyone with this link can follow along. No sign-in needed.</p>
        <div className="code">{game.code}</div>
        {qr && <img className="qr" src={qr} alt="QR code for the live stats link" />}
        <input readOnly value={link} onFocus={(e) => e.target.select()} />
        <div className="row">
          <button className="btn primary" onClick={copy}>{copied ? 'Copied ✓' : 'Copy link'}</button>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
