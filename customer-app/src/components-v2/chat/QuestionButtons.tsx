import React, { useState } from 'react';
import { theme } from '../../theme';
import { KBQuestionResult } from '../../types';

interface Props {
  topic: string;
  questions: KBQuestionResult[];
  onSelect: (question: KBQuestionResult | 'Something else') => void;
  disabled: boolean;
}

export function QuestionButtons({ topic, questions, onSelect, disabled }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleClick = (question: KBQuestionResult | 'Something else') => {
    const key = question === 'Something else' ? 'Something else' : question.id;
    if (disabled || selected) return;
    setSelected(key);
    onSelect(question);
  };

  const btnBase: React.CSSProperties = {
    width: '100%',
    textAlign: 'left',
    padding: '9px 12px',
    borderRadius: theme.radius.md,
    fontSize: 13,
    lineHeight: 1.45,
    cursor: (disabled || !!selected) ? 'default' : 'pointer',
    transition: 'all .15s',
    fontWeight: 500,
    fontFamily: theme.font.sans,
    whiteSpace: 'normal',
    wordBreak: 'break-word',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{
        fontSize: 11, color: theme.color.textMuted, marginBottom: 2,
        textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600,
      }}>
        What would you like to know about <span style={{ color: theme.color.text }}>{topic}</span>?
      </div>
      {questions.map(q => (
        <button
          key={q.id}
          onClick={() => handleClick(q)}
          style={{
            ...btnBase,
            border: `1px solid ${selected === q.id ? theme.color.primary : theme.color.primarySoftBorder}`,
            background: selected === q.id ? theme.color.primary : theme.color.primarySoft,
            color: selected === q.id ? theme.color.textOnPrimary : theme.color.primary,
            opacity: (disabled || (!!selected && selected !== q.id)) ? 0.45 : 1,
          }}
        >
          {q.text}
        </button>
      ))}
      <button
        onClick={() => handleClick('Something else')}
        style={{
          ...btnBase,
          border: `1px solid ${selected === 'Something else' ? theme.color.primary : theme.color.border}`,
          background: selected === 'Something else' ? theme.color.primary : theme.color.surface,
          color: selected === 'Something else' ? theme.color.textOnPrimary : theme.color.textMuted,
          opacity: (disabled || (!!selected && selected !== 'Something else')) ? 0.45 : 1,
        }}
      >
        Something else
      </button>
    </div>
  );
}
