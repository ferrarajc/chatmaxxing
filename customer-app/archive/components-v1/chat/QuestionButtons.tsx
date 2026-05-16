import React, { useState } from 'react';
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>
        What would you like to know about <strong>{topic}</strong>?
      </div>
      {questions.map(q => (
        <button
          key={q.id}
          onClick={() => handleClick(q)}
          style={{
            width: '100%',
            textAlign: 'left',
            padding: '8px 12px',
            borderRadius: 8,
            border: '1.5px solid #1a56db',
            background: selected === q.id ? '#1a56db' : '#f0f4ff',
            color: selected === q.id ? '#fff' : '#1a56db',
            fontSize: 13,
            lineHeight: 1.4,
            cursor: (disabled || !!selected) ? 'default' : 'pointer',
            opacity: (disabled || (!!selected && selected !== q.id)) ? 0.45 : 1,
            transition: 'all .15s',
            fontWeight: 500,
            whiteSpace: 'normal',
            wordBreak: 'break-word',
          }}
        >
          {q.text}
        </button>
      ))}
      <button
        onClick={() => handleClick('Something else')}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '8px 12px',
          borderRadius: 8,
          border: '1.5px solid #1a56db',
          background: selected === 'Something else' ? '#1a56db' : '#f0f4ff',
          color: selected === 'Something else' ? '#fff' : '#1a56db',
          fontSize: 13,
          lineHeight: 1.4,
          cursor: (disabled || !!selected) ? 'default' : 'pointer',
          opacity: (disabled || (!!selected && selected !== 'Something else')) ? 0.45 : 1,
          transition: 'all .15s',
          fontWeight: 500,
          whiteSpace: 'normal',
        }}
      >
        Something else
      </button>
    </div>
  );
}
