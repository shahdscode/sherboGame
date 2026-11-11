import React from 'react';
import {
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  Send,
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

  // Determine which sticker character to display beside the question modal
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

  return (
    <div
      className="overlay-backdrop question-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="question-modal-heading"
      data-testid="question-modal"
    >
      <div className="question-stage-layout">
        {/* Large Sticker Character OUTSIDE the Question Box on the Side */}
        <div className="question-side-sticker-container">
          <img
            key={characterImgSrc}
            src={characterImgSrc}
            alt={characterImgAlt}
            className="question-character-sticker-large"
            data-testid="question-character-sticker"
          />
        </div>

        {/* Question Box */}
        <div className="modal-card question-modal-card">
          <div className="question-header-bar">
            <div
              className="checkpoint-pill"
              data-testid="question-checkpoint-badge"
            >
              <HelpCircle size={18} />
              <span>
                CHECKPOINT {question.checkpointNumber} OF{' '}
                {towerConfig.numberOfCheckpoints}
              </span>
            </div>
            <span className="step-milestone-tag">
              Step {question.checkpointNumber * towerConfig.stepsPerCheckpoint}{' '}
              Reached
            </span>
          </div>

          <h2 id="question-modal-heading" className="question-title">
            {question.title}
          </h2>

          <p className="question-prompt" data-testid="question-prompt">
            {renderFormattedMathText(question.prompt)}
          </p>

          <div
            className="options-list"
            role="radiogroup"
            aria-label="Answer Options"
          >
            {question.options.map((optionText, index) => {
              const isSelected = feedback.selectedOptionIndex === index;
              let stateClass = '';
              if (isSelected) {
                if (isCorrect) stateClass = 'option-correct';
                else if (isIncorrect) stateClass = 'option-incorrect';
                else stateClass = 'option-selected';
              }

              return (
                <button
                  key={index}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  disabled={isCorrect}
                  className={`option-btn ${stateClass}`}
                  onClick={() => onSelectOption(index)}
                  data-testid={`question-option-${index}`}
                >
                  <span className="option-letter">{OPTION_LETTERS[index]}</span>
                  <span className="option-text">
                    {renderFormattedMathText(optionText)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Feedback Box for Incorrect Answers & Hint */}
          {isIncorrect && (
            <div
              className="feedback-banner feedback-incorrect"
              role="alert"
              data-testid="feedback-incorrect"
            >
              <div className="feedback-title">
                <AlertTriangle size={20} />
                <span>Not quite right! Try selecting another option.</span>
              </div>
              {feedback.hint && (
                <div className="feedback-hint" data-testid="feedback-hint">
                  <Lightbulb size={18} className="hint-icon" />
                  <span>
                    <strong>Hint:</strong>{' '}
                    {renderFormattedMathText(feedback.hint)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Feedback Box for Correct Answers & Explanation */}
          {isCorrect && (
            <div
              className="feedback-banner feedback-correct"
              role="status"
              data-testid="feedback-correct"
            >
              <div className="feedback-title">
                <CheckCircle2 size={20} />
                <span>Correct! Great job!</span>
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

          <div className="question-actions">
            {!isCorrect ? (
              <button
                type="button"
                className="primary-cta-btn submit-answer-btn"
                disabled={feedback.selectedOptionIndex === null}
                onClick={onSubmitAnswer}
                data-testid="submit-answer-btn"
              >
                <Send size={19} />
                <span>Check Answer</span>
              </button>
            ) : (
              <button
                type="button"
                className="primary-cta-btn continue-climb-btn"
                onClick={onContinue}
                data-testid="continue-climbing-btn"
              >
                <span>Continue Climbing</span>
                <ArrowRight size={20} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
