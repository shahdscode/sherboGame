import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import {
  Sparkles,
  CheckCircle2,
  Lightbulb,
  ArrowRight,
  Zap,
  Lock,
  Unlock,
  ShieldAlert,
  Maximize2,
  X,
} from 'lucide-react';
import { CheckpointQuestion, towerConfig } from '../data/towerConfig';
import { QuestionAttemptFeedback } from '../hooks/useTowerGame';
import { sfx } from '../game/sfx';
import { assetUrl } from '../utils/assetUrl';

interface QuestionModalProps {
  question: CheckpointQuestion;
  feedback: QuestionAttemptFeedback;
  onSelectOption: (index: number) => void;
  onSubmitAnswer: () => void;
  /** After a wrong answer (marked, solution hidden), moves on to a fresh question. */
  onNextQuestion: () => void;
  onContinue: () => void;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];
const BLOCK_THEMES = [
  'arcade-tile-cyan',
  'arcade-tile-gold',
  'arcade-tile-violet',
  'arcade-tile-coral',
];

const MAIN_STICKER = assetUrl('/stickers/main-sticker.webp');

const CELEBRATION_STICKERS = [
  assetUrl('/stickers/celebrate-clap.webp'),
  assetUrl('/stickers/celebrate-confetti.webp'),
  assetUrl('/stickers/celebrate-happy.webp'),
  assetUrl('/stickers/celebrate-cheer.webp'),
  assetUrl('/stickers/celebrate-clap-cheer.webp'),
  assetUrl('/stickers/celebrate-confetti-dance.webp'),
];

const UNICODE_SUBSCRIPT_MAP: Record<string, string> = {
  '₀': '0',
  '₁': '1',
  '₂': '2',
  '₃': '3',
  '₄': '4',
  '₅': '5',
  '₆': '6',
  '₇': '7',
  '₈': '8',
  '₉': '9',
  'ₙ': 'n',
};

const UNICODE_SUPERSCRIPT_MAP: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
  'ⁿ': 'n',
};

/**
 * Renders inline superscripts (^n, ^(n-1), ², ³, ⁴) and subscripts (a₁, a₂, Sₙ, _1).
 */
function renderInlineMathParts(text: string, keyPrefix: string = ''): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex =
    /\^\(([^)]+)\)|\^([a-zA-Z0-9+-]+)|_\(([^)]+)\)|_([a-zA-Z0-9+-]+)|([⁰¹²³⁴⁵⁶⁷⁸⁹ⁿ]+)|([₀₁₂₃₄₅₆₇₈₉ₙ]+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const supExpr = match[1] ?? match[2];
    const subExpr = match[3] ?? match[4];
    const uniSup = match[5];
    const uniSub = match[6];

    if (supExpr !== undefined) {
      parts.push(
        <sup key={`${keyPrefix}sup-${match.index}`} className="math-sup">
          {supExpr}
        </sup>
      );
    } else if (uniSup !== undefined) {
      const normalized = uniSup
        .split('')
        .map((ch) => UNICODE_SUPERSCRIPT_MAP[ch] ?? ch)
        .join('');
      parts.push(
        <sup key={`${keyPrefix}usup-${match.index}`} className="math-sup">
          {normalized}
        </sup>
      );
    } else if (subExpr !== undefined) {
      parts.push(
        <sub key={`${keyPrefix}sub-${match.index}`} className="math-sub">
          {subExpr}
        </sub>
      );
    } else if (uniSub !== undefined) {
      const normalized = uniSub
        .split('')
        .map((ch) => UNICODE_SUBSCRIPT_MAP[ch] ?? ch)
        .join('');
      parts.push(
        <sub key={`${keyPrefix}usub-${match.index}`} className="math-sub">
          {normalized}
        </sub>
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

/**
 * Formats mathematical strings so fractions (1/3, 4/r), powers (^n, ⁴),
 * and subscripts (a₁, Sₙ) render with proper visual mathematical notation.
 */
export function renderFormattedMathText(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const fracRegex = /([a-zA-Z0-9₀-₉ₙ]+)\/([a-zA-Z0-9₀-₉ₙ]+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fracRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <React.Fragment key={`txt-${lastIndex}`}>
          {renderInlineMathParts(text.slice(lastIndex, match.index), `t${lastIndex}-`)}
        </React.Fragment>
      );
    }

    const num = match[1];
    const den = match[2];
    parts.push(
      <span key={`frac-${match.index}`} className="math-frac">
        <span className="math-frac-num">
          {renderInlineMathParts(num, `fn${match.index}-`)}
        </span>
        <span className="math-frac-den">
          {renderInlineMathParts(den, `fd${match.index}-`)}
        </span>
      </span>
    );

    lastIndex = fracRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(
      <React.Fragment key={`txt-end-${lastIndex}`}>
        {renderInlineMathParts(text.slice(lastIndex), `te${lastIndex}-`)}
      </React.Fragment>
    );
  }

  return parts.length > 0 ? parts : renderInlineMathParts(text);
}

export const QuestionModal: React.FC<QuestionModalProps> = ({
  question,
  feedback,
  onSelectOption,
  onSubmitAnswer,
  onNextQuestion,
  onContinue,
}) => {
  const isCorrect = feedback.status === 'correct';
  const isIncorrect = feedback.status === 'incorrect';
  const isReview = feedback.status === 'review';

  // Duck background music while question is open so options and voice clips are crystal clear
  useEffect(() => {
    sfx.duckMusic(true);
    return () => {
      sfx.duckMusic(false);
    };
  }, []);

  // Free clue: the student can reveal the question's hint whenever they want
  const [hintVisible, setHintVisible] = useState(false);
  useEffect(() => {
    setHintVisible(false);
  }, [question.id]);

  // Tap the question image to see it full screen (pinch-zoom is disabled in the game)
  const [imageZoomed, setImageZoomed] = useState(false);
  useEffect(() => {
    setImageZoomed(false);
  }, [question.id]);

  // Fire mini confetti burst when gate is unlocked
  useEffect(() => {
    if (!isCorrect) return;
    try {
      confetti({
        particleCount: 45,
        spread: 65,
        origin: { y: 0.65 },
      });
    } catch {
      // Ignore confetti errors in headless environments
    }
  }, [isCorrect]);

  // Keyboard shortcuts: 1-4 or A-D to pick a power block, Enter to confirm, Enter/Space to continue after solving
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // While the image is enlarged, keys must not pick or submit answers behind it
      if (imageZoomed) {
        if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setImageZoomed(false);
        }
        return;
      }

      if (isCorrect) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onContinue();
        }
        return;
      }

      if (isReview) {
        if (e.key === 'Enter') {
          e.preventDefault();
          onNextQuestion();
        }
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        onSubmitAnswer();
        return;
      }

      // Ignore auto-repeat so a movement key still held from climbing (A / D) cannot
      // pre-select an answer the moment the question opens
      if (e.repeat) return;

      const key = e.key.toUpperCase();
      if (key === '1' || key === 'A') onSelectOption(0);
      else if (key === '2' || key === 'B') onSelectOption(1);
      else if (key === '3' || key === 'C') onSelectOption(2);
      else if (key === '4' || key === 'D') onSelectOption(3);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [imageZoomed, isCorrect, isReview, onContinue, onNextQuestion, onSelectOption, onSubmitAnswer]);

  // Pick one celebration sticker per question and preload it immediately so transition is instant and zero-flicker
  const celebrationSticker = useMemo(() => {
    return CELEBRATION_STICKERS[
      Math.floor(Math.random() * CELEBRATION_STICKERS.length)
    ];
  }, [question.id]);

  useEffect(() => {
    const urls = [
      MAIN_STICKER,
      celebrationSticker,
    ];
    urls.forEach((url) => {
      const img = new Image();
      img.src = url;
    });
  }, [celebrationSticker]);

  // Determine which sticker character to display
  const characterImgSrc = isCorrect
    ? celebrationSticker
    : MAIN_STICKER;

  const characterImgAlt = isCorrect
    ? 'Good Job Character'
    : isIncorrect
      ? 'Retry Character'
      : 'Question Character';

  // Keep outgoing sticker briefly mounted for a silky-smooth crossfade transition
  const [outgoingSrc, setOutgoingSrc] = useState<string | null>(null);
  const lastSrcRef = useRef<string>(characterImgSrc);

  useEffect(() => {
    if (lastSrcRef.current !== characterImgSrc) {
      setOutgoingSrc(lastSrcRef.current);
      lastSrcRef.current = characterImgSrc;
      const timer = window.setTimeout(() => {
        setOutgoingSrc(null);
      }, 520);
      return () => window.clearTimeout(timer);
    }
  }, [characterImgSrc]);

  const mistakeCount = feedback.attemptsForCurrentQuestion;
  const characterMoodTag = isCorrect
    ? 'GATE UNLOCKED!'
    : isReview
      ? 'TRY AGAIN!'
      : mistakeCount === 1
      ? 'NEXT QUESTION! (450 XP Bounty)'
      : mistakeCount === 2
        ? 'KEEP TRYING! (300 XP Bounty)'
        : mistakeCount >= 3
          ? 'SOLVE TO ADVANCE! (0 XP Gate)'
          : 'CRACK THE CODE!';

  const currentPotentialXp =
    feedback.status === 'correct'
      ? feedback.earnedXp ?? 500
      : feedback.potentialXp ?? 500;

  const solvedAnswerText = question.options[question.correctAnswer];

  return (
    <div
      className="overlay-backdrop question-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="question-modal-heading"
      data-testid="question-modal"
    >
      <div className="arcade-gate-arena">
        {/* Top Gate Progress & XP Bounty Bar */}
        <div className="arcade-gate-topbar">
          <div
            className="checkpoint-pill"
            data-testid="question-checkpoint-badge"
          >
            {isCorrect ? <Unlock size={16} /> : <Lock size={16} />}
            <span>
              GATE {question.checkpointNumber} / {towerConfig.numberOfCheckpoints}
            </span>
          </div>

          <div className="gate-crystals-row" aria-label="Tower Gate Crystals">
            {Array.from(
              { length: towerConfig.numberOfCheckpoints },
              (_, idx) => {
                const gateNum = idx + 1;
                const state =
                  gateNum < question.checkpointNumber ||
                  (gateNum === question.checkpointNumber && isCorrect)
                    ? 'cleared'
                    : gateNum === question.checkpointNumber
                      ? 'current'
                      : 'locked';
                return (
                  <span
                    key={gateNum}
                    className={`gate-crystal-dot gate-crystal-${state}`}
                    title={`Gate ${gateNum}`}
                  >
                    {gateNum}
                  </span>
                );
              }
            )}
          </div>

          <div
            className={`gate-xp-bounty ${
              isCorrect
                ? 'gate-xp-earned'
                : isIncorrect
                  ? 'gate-xp-penalized'
                  : ''
            }`}
          >
            <Zap size={15} />
            <span>
              {isCorrect
                ? `+${currentPotentialXp} XP EARNED!`
                : `+${currentPotentialXp} XP BOUNTY`}
            </span>
          </div>
        </div>

        {/* Main Arcade Stage: Sherbo Sticker + Speech Bubble & Rune Stones */}
        <div className="question-stage-layout">
          {/* Large Sticker Character with Mood Ribbon */}
          <div className="question-side-sticker-container">
            <div
              className={`sticker-halo ${
                isCorrect
                  ? 'halo-correct'
                  : isIncorrect || isReview
                    ? 'halo-incorrect'
                    : 'halo-active'
              }`}
            >
              {outgoingSrc && outgoingSrc !== characterImgSrc && (
                <img
                  key={`out-${outgoingSrc}`}
                  src={outgoingSrc}
                  alt=""
                  aria-hidden="true"
                  className="question-character-sticker-large sticker-layer-outgoing"
                />
              )}
              <img
                key={characterImgSrc}
                src={characterImgSrc}
                alt={characterImgAlt}
                className={`question-character-sticker-large ${
                  isCorrect ? 'sticker-celebrating' : ''
                }`}
                data-testid="question-character-sticker"
              />
            </div>
            <span
              className={`sticker-mood-pill ${
                isCorrect
                  ? 'mood-correct'
                  : isIncorrect || isReview
                    ? 'mood-incorrect'
                    : 'mood-active'
              }`}
            >
              {characterMoodTag}
            </span>
          </div>

          {/* Interactive Rune Gate Challenge Card */}
          <div className="modal-card question-modal-card">
            {/* Comic Speech Bubble from Sherbo */}
            <div className="sherbo-speech-bubble">
              {question.title && (
                <div className="speech-header-row">
                  <h2 id="question-modal-heading" className="question-title">
                    {question.title}
                  </h2>
                </div>
              )}

              <p className="question-prompt" data-testid="question-prompt">
                {renderFormattedMathText(question.prompt)}
              </p>

              {question.image && (
                <button
                  type="button"
                  className="question-image-btn"
                  onClick={() => setImageZoomed(true)}
                  aria-label="Enlarge image"
                  data-testid="question-image-zoom"
                >
                  <img
                    className="question-image"
                    src={question.image}
                    alt=""
                    loading="eager"
                  />
                  <span className="question-image-zoom-badge" aria-hidden="true">
                    <Maximize2 size={14} />
                  </span>
                </button>
              )}

              {/* Visual Stepping-Stone Sequence Track */}
              {question.sequence && question.sequence.length > 0 && (
                <div
                  className="sequence-stones-track"
                  aria-label="Sequence Pattern Stones"
                >
                  {question.sequence.map((item, idx) => {
                    const isMystery = item.includes('?');
                    const displayValue =
                      isMystery && (isCorrect || isReview) ? solvedAnswerText : item;

                    return (
                      <React.Fragment key={idx}>
                        <div
                          className={`sequence-stone ${
                            isMystery
                              ? isCorrect
                                ? 'stone-solved'
                                : 'stone-mystery'
                              : ''
                          }`}
                        >
                          {renderFormattedMathText(displayValue)}
                        </div>
                        {idx < question.sequence!.length - 1 && (
                          <span className="sequence-arrow" aria-hidden="true">
                            ➔
                          </span>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Instruction Prompt for 1-Tap Power Blocks */}
            <div className="power-blocks-header">
              <Sparkles size={14} className="icon-gold" />
              <span>
                {isCorrect
                  ? 'Gate code unlocked! Ready to climb!'
                  : isReview
                    ? 'That stone did not open the gate — try a new question:'
                    : 'Tap the correct Power Stone to unlock the gate:'}
              </span>
            </div>

            {/* 2x2 Tactile 3D Arcade Power-Block Options */}
            <div
              className="options-list"
              role="radiogroup"
              aria-label="Power Stone Options"
            >
              {question.options.map((optionText, index) => {
                const isSelected = feedback.selectedOptionIndex === index;
                const isWrongTried = feedback.wrongOptionIndices.includes(index);
                const isSolvedRight =
                  (isCorrect || isReview) && index === question.correctAnswer;
                const optionPenalty = feedback.wrongPenalties?.[index];

                let stateClass = BLOCK_THEMES[index % BLOCK_THEMES.length];
                if (isSolvedRight) {
                  stateClass = 'option-correct';
                } else if (isWrongTried) {
                  stateClass = 'option-incorrect';
                } else if (isSelected) {
                  stateClass += ' option-selected';
                }

                return (
                  <button
                    key={index}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    disabled={isCorrect || isReview || isWrongTried}
                    className={`option-btn arcade-power-tile ${stateClass}`}
                    onClick={() => onSelectOption(index)}
                    data-testid={`question-option-${index}`}
                  >
                    <span className="option-letter">
                      {isSolvedRight
                        ? '✓'
                        : isWrongTried
                          ? '✗'
                          : OPTION_LETTERS[index]}
                    </span>
                    <span className="option-text">
                      {renderFormattedMathText(optionText)}
                    </span>
                    {isWrongTried && (
                      <span className="option-penalty-badge">
                        Incorrect
                      </span>
                    )}
                    {isSolvedRight && (
                      <span className="option-penalty-badge option-correct-badge">
                        Correct
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Free clue (never costs XP) */}
            {!isCorrect && !isReview && question.hint && (
              hintVisible ? (
                <div className="feedback-hint clue-box" data-testid="feedback-hint">
                  <Lightbulb size={16} className="hint-icon" />
                  <span>
                    <strong>Sherbo&apos;s Clue:</strong>{' '}
                    {renderFormattedMathText(question.hint)}
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  className="clue-toggle-btn"
                  onClick={() => setHintVisible(true)}
                  data-testid="show-clue-btn"
                >
                  <Lightbulb size={15} />
                  <span>Need a clue?</span>
                </button>
              )
            )}

            {/* Show the solution during the short review before the next question. */}
            {isReview && (
              <div
                className="feedback-banner feedback-incorrect feedback-review"
                role="alert"
                data-testid="feedback-review"
              >
                <div className="feedback-title">
                  <ShieldAlert size={18} />
                  <span>
                    Not quite!{' '}
                    {feedback.currentLoss ? (
                      <strong>−{feedback.currentLoss} XP</strong>
                    ) : (
                      <>This gate now awards <strong>0 XP</strong></>
                    )}
                    . Try a new question to open the gate.
                  </span>
                </div>
                <p
                  className="feedback-explanation"
                  data-testid="feedback-correct-answer"
                >
                  Correct answer: {renderFormattedMathText(solvedAnswerText)}
                </p>
              </div>
            )}

            {/* Feedback Banner for Incorrect Attempts + Instant Hint */}
            {isIncorrect && (
              <div
                className="feedback-banner feedback-incorrect"
                role="alert"
                data-testid="feedback-incorrect"
              >
                <div className="feedback-title">
                  <ShieldAlert size={18} />
                  <span>
                    {mistakeCount === 1 && (
                      <>New question! Solve it for <strong>+450 XP</strong>.</>
                    )}
                    {mistakeCount === 2 && (
                      <>New question! Solve it for <strong>+300 XP</strong>.</>
                    )}
                    {mistakeCount >= 3 && (
                      <>3+ mistakes — this checkpoint now awards <strong>0 XP</strong>, but solve a question to advance!</>
                    )}
                  </span>
                </div>
              </div>
            )}

            {/* Feedback Banner for Correct Answer & Explanation */}
            {isCorrect && (
              <div
                className="feedback-banner feedback-correct"
                role="status"
                data-testid="feedback-correct"
              >
                <div className="feedback-title">
                  <CheckCircle2 size={19} />
                  <span>
                    Boom! Gate Unlocked! (+{currentPotentialXp} XP)
                  </span>
                </div>
                {feedback.explanation && (
                  <p
                    className="feedback-explanation"
                    data-testid="feedback-explanation"
                  >
                    {renderFormattedMathText(feedback.explanation)}
                  </p>
                )}
              </div>
            )}

            {/* Action Bar */}
            <div className="question-actions">
              {isReview ? (
                <button
                  type="button"
                  className="primary-cta-btn submit-answer-btn arcade-hint-cta cta-ready"
                  onClick={onNextQuestion}
                  data-testid="next-question-btn"
                >
                  <span>Try a New Question</span>
                  <ArrowRight size={18} />
                </button>
              ) : !isCorrect ? (
                <button
                  type="button"
                  className={`primary-cta-btn submit-answer-btn arcade-hint-cta ${
                    feedback.selectedOptionIndex !== null ? 'cta-ready' : ''
                  }`}
                  disabled={feedback.selectedOptionIndex === null}
                  onClick={onSubmitAnswer}
                  data-testid="submit-answer-btn"
                >
                  <Zap size={18} />
                  <span>
                    {feedback.selectedOptionIndex === null
                      ? 'Pick a Power Stone'
                      : 'Confirm Answer'}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  className="primary-cta-btn continue-climb-btn"
                  onClick={onContinue}
                  data-testid="continue-climbing-btn"
                >
                  <span>Unlock Gate &amp; Climb!</span>
                  <ArrowRight size={20} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Portal: the backdrop's blur/transform would trap a fixed overlay inside it */}
      {imageZoomed &&
        question.image &&
        createPortal(
          <div
            className="image-lightbox"
            role="dialog"
            aria-modal="true"
            aria-label="Question image"
            onClick={() => setImageZoomed(false)}
            data-testid="question-image-lightbox"
          >
            <img className="image-lightbox-img" src={question.image} alt="" />
            <button
              type="button"
              className="image-lightbox-close"
              aria-label="Close image"
              onClick={() => setImageZoomed(false)}
            >
              <X size={22} />
            </button>
          </div>,
          document.body
        )}
    </div>
  );
};
