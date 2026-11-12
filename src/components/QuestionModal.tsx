import React, { useEffect } from 'react';
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
} from 'lucide-react';
import { CheckpointQuestion, towerConfig } from '../data/towerConfig';
import { QuestionAttemptFeedback } from '../hooks/useTowerGame';

interface QuestionModalProps {
  question: CheckpointQuestion;
  feedback: QuestionAttemptFeedback;
  onSelectOption: (index: number) => void;
  onSubmitAnswer: () => void;
  onContinue: () => void;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];
const BLOCK_THEMES = [
  'arcade-tile-cyan',
  'arcade-tile-gold',
  'arcade-tile-violet',
  'arcade-tile-coral',
];

/**
 * Formats mathematical strings so powers like `^(n - 1)` or `^5` render with proper
 * HTML `<sup>...</sup>` superscript above the number instead of showing a caret `^`.
 */
export function renderFormattedMathText(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /\^\(([^)]+)\)|\^([a-zA-Z0-9+-]+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const exponentContent = match[1] ?? match[2];
    parts.push(
      <sup key={match.index} className="math-sup">
        {exponentContent}
      </sup>
    );
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

export const QuestionModal: React.FC<QuestionModalProps> = ({
  question,
  feedback,
  onSelectOption,
  onSubmitAnswer,
  onContinue,
}) => {
  const isCorrect = feedback.status === 'correct';
  const isIncorrect = feedback.status === 'incorrect';

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

  // Keyboard shortcuts: 1-4 or A-D to pick a power block, Enter/Space to continue after solving
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCorrect) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onContinue();
        }
        return;
      }

      const key = e.key.toUpperCase();
      if (key === '1' || key === 'A') onSelectOption(0);
      else if (key === '2' || key === 'B') onSelectOption(1);
      else if (key === '3' || key === 'C') onSelectOption(2);
      else if (key === '4' || key === 'D') onSelectOption(3);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCorrect, onContinue, onSelectOption]);

  // Determine which sticker character to display
  const characterImgSrc = isCorrect
    ? '/stickers/goodjob.png'
    : isIncorrect
      ? '/stickers/retry.png'
      : '/stickers/question.png';

  const characterImgAlt = isCorrect
    ? 'Good Job Character'
    : isIncorrect
      ? 'Retry Character'
      : 'Question Character';

  const characterMoodTag = isCorrect
    ? 'GATE UNLOCKED!'
    : feedback.wrongOptionIndices.length === 1
      ? 'TRY ANOTHER STONE! (-50 XP)'
      : feedback.wrongOptionIndices.length === 2
        ? 'KEEP TRYING! (-150 XP)'
        : feedback.wrongOptionIndices.length >= 3
          ? 'LAST CHANCE! (0 XP)'
          : 'CRACK THE CODE!';

  const currentPotentialXp =
    feedback.status === 'correct'
      ? feedback.earnedXp ?? 300
      : feedback.potentialXp ?? 300;

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
                ? `+${currentPotentialXp} / 300 XP EARNED!`
                : `+${currentPotentialXp} / 300 XP`}
            </span>
            {isIncorrect && feedback.currentLoss && (
              <span className="live-penalty-pill">
                -{feedback.currentLoss} XP
              </span>
            )}
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
                  : isIncorrect
                    ? 'halo-incorrect'
                    : 'halo-active'
              }`}
            >
              <img
                key={characterImgSrc}
                src={characterImgSrc}
                alt={characterImgAlt}
                className="question-character-sticker-large"
                data-testid="question-character-sticker"
              />
            </div>
            <span
              className={`sticker-mood-pill ${
                isCorrect
                  ? 'mood-correct'
                  : isIncorrect
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
              <div className="speech-header-row">
                <h2 id="question-modal-heading" className="question-title">
                  {question.title}
                </h2>
                <span className="step-milestone-tag">
                  Step {question.checkpointNumber * towerConfig.stepsPerCheckpoint}
                </span>
              </div>

              <p className="question-prompt" data-testid="question-prompt">
                {renderFormattedMathText(question.prompt)}
              </p>

              {/* Visual Stepping-Stone Sequence Track */}
              {question.sequence && question.sequence.length > 0 && (
                <div
                  className="sequence-stones-track"
                  aria-label="Sequence Pattern Stones"
                >
                  {question.sequence.map((item, idx) => {
                    const isMystery = item.includes('?');
                    const displayValue =
                      isMystery && isCorrect ? solvedAnswerText : item;

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
                  isCorrect && index === question.correctAnswer;
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
                    disabled={isCorrect || isWrongTried}
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
                    {optionPenalty && (
                      <span className="option-penalty-badge">
                        -{optionPenalty} XP
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

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
                    {feedback.wrongOptionIndices.length === 1 && (
                      <>1st Mistake: <strong>-50 XP</strong> deducted! Pick another glowing stone.</>
                    )}
                    {feedback.wrongOptionIndices.length === 2 && (
                      <>2nd Mistake: <strong>-150 XP</strong> total penalty! Pick another glowing stone.</>
                    )}
                    {feedback.wrongOptionIndices.length >= 3 && (
                      <>3rd Mistake: <strong>-300 XP</strong> penalty (0 XP left)! Crack the code to pass.</>
                    )}
                  </span>
                </div>
                {feedback.hint && (
                  <div className="feedback-hint" data-testid="feedback-hint">
                    <Lightbulb size={16} className="hint-icon" />
                    <span>
                      <strong>Sherbo&apos;s Clue:</strong>{' '}
                      {renderFormattedMathText(feedback.hint)}
                    </span>
                  </div>
                )}
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
                    Boom! Gate Unlocked! (+{currentPotentialXp} / 300 XP)
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
              {!isCorrect ? (
                <button
                  type="button"
                  className="primary-cta-btn submit-answer-btn arcade-hint-cta"
                  disabled={feedback.selectedOptionIndex === null}
                  onClick={onSubmitAnswer}
                  data-testid="submit-answer-btn"
                >
                  <Zap size={18} />
                  <span>Tap Any Power Stone Above to Unlock</span>
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
    </div>
  );
};
