'use client';

import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { X, QrCode as QrIcon, Copy, Check, ExternalLink } from 'lucide-react';

import { OrganizerTeamSummary } from '@/lib/types';

interface Props {
  team: OrganizerTeamSummary | null;
  isOpen: boolean;
  onClose: () => void;
}

export function TeamQrModal({ team, isOpen, onClose }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const copyBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (team && isOpen && team.accessUrl) {
      QRCode.toDataURL(team.accessUrl, {
        width: 280,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('QR code generation error:', err));
    }
  }, [team, isOpen]);

  // Autofocus copy button on modal open for quick keyboard action
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        copyBtnRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Escape key listener for closing modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !team) return null;

  const handleCopyLink = () => {
    if (team.accessUrl) {
      navigator.clipboard.writeText(team.accessUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl bg-gradient-to-b from-gray-900 to-[#0e070a] border border-amber-900/50 p-6 shadow-2xl space-y-5 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="flex items-center gap-2">
            <QrIcon className="w-5 h-5 text-amber-400" />
            <span className="font-bold text-gray-200 text-sm">Team Access Credentials</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-white/5 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Team Identity */}
        <div>
          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/30">
            Team #{team.teamNumber < 10 ? `0${team.teamNumber}` : team.teamNumber}
          </span>
          <h3 className="text-xl font-bold text-gray-100 mt-2">{team.teamName}</h3>
        </div>

        {/* QR Code */}
        <div className="p-3 bg-white rounded-xl shadow-lg inline-block mx-auto border-4 border-amber-500/30">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt={`QR for Team ${team.teamNumber}`} className="w-48 h-48 mx-auto" />
          ) : (
            <div className="w-48 h-48 flex items-center justify-center text-gray-500 text-xs">
              Generating QR...
            </div>
          )}
        </div>

        {/* Security Note on PIN */}
        <div className="p-3 rounded-xl bg-black/70 border border-gray-800 space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-widest text-amber-500/80">
            Confidential Team PIN
          </span>
          <p className="text-xs text-gray-300">
            PINs are sealed in the exported <code className="text-amber-400 font-mono text-[11px]">team_credentials.json</code> file for physical team-card distribution.
          </p>
          <span className="text-[10px] text-gray-500 block">
            Plaintext PINs are never stored in the live database.
          </span>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <button
            ref={copyBtnRef}
            type="button"
            onClick={handleCopyLink}
            className="w-full py-2.5 px-4 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold rounded-xl border border-gray-700 transition flex items-center justify-center gap-2"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400">Link Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-gray-400" />
                <span>Copy Private Team Link</span>
              </>
            )}
          </button>

          <a
            href={team.accessUrl || '#'}
            target="_blank"
            rel="noreferrer"
            className="w-full py-2.5 px-4 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold rounded-xl border border-amber-500/30 transition flex items-center justify-center gap-2"
          >
            <span>Open Team Login In New Tab</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
