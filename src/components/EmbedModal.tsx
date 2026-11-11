import React, { useState } from 'react';
import { Copy, Check, X, Code, ExternalLink } from 'lucide-react';

interface EmbedModalProps {
  onClose: () => void;
}

export const EmbedModal: React.FC<EmbedModalProps> = ({ onClose }) => {
  const [copied, setCopied] = useState(false);

  const currentUrl =
    typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : 'https://sherbo-game.vercel.app';

  const embedCode = `<iframe
  src="${currentUrl}"
  width="100%"
  height="720"
  style="border: none; border-radius: 16px; max-width: 760px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.4);"
  allow="autoplay; fullscreen"
  loading="lazy"
></iframe>`;

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(embedCode);
      } else {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = embedCode;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      // Ignore
    }
  };

  return (
    <div
      className="overlay-backdrop embed-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="modal-card embed-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="embed-header">
          <div className="embed-title-group">
            <Code size={22} className="icon-cyan" />
            <h2 className="embed-heading">Embed Game in Your Website</h2>
          </div>
          <button
            type="button"
            className="embed-close-btn"
            onClick={onClose}
            aria-label="Close embed modal"
          >
            <X size={20} />
          </button>
        </div>

        <p className="embed-desc">
          Copy and paste this HTML snippet into any website (WordPress, Webflow,
          Squarespace, Wix, Notion, Canvas, or custom HTML) to embed the game
          just like a YouTube video:
        </p>

        <div className="embed-code-wrapper">
          <pre className="embed-code-box">
            <code>{embedCode}</code>
          </pre>
          <button
            type="button"
            className={`copy-code-btn ${copied ? 'copied' : ''}`}
            onClick={handleCopy}
            aria-label="Copy HTML embed code"
          >
            {copied ? (
              <>
                <Check size={16} />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy size={16} />
                <span>Copy Code</span>
              </>
            )}
          </button>
        </div>

        <div className="embed-tips-box">
          <strong>Tip:</strong> You can adjust <code>height="720"</code> or{' '}
          <code>max-width: 760px</code> to fit your site's layout.
        </div>
      </div>
    </div>
  );
};
