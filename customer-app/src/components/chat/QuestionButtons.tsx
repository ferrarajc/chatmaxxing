import React, { useState } from 'react';

interface Props {
  topic: string;
  questions: string[];
  onSelect: (question: string) => void;
  disabled: boolean;
}

export function QuestionButtons({ topic, questions, onSelect, disabled }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const all = [...questions, 'Something else'];

  const handleClick = (question: string) => {
    if (disabled || selected) return;
    setSelected(question);
    onSelect(question);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>
        What would you like to know about <strong>{topic}</strong>?
      </div>
      {all.map(question => (
        <button
          key={question}
          onClick={() => handleClick(question)}
          style={{
            width: '100%',
            textAlign: 'left',
            padding: '8px 12px',
            borderRadius: 8,
            border: '1.5px solid #1a56db',
            background: selected === question ? '#1a56db' : '#f0f4ff',
            color: selected === question ? '#fff' : '#1a56db',
            fontSize: 13,
            lineHeight: 1.4,
            cursor: (disabled || !!selected) ? 'default' : 'pointer',
            opacity: (disabled || (!!selected && selected !== question)) ? 0.45 : 1,
            transition: 'all .15s',
            fontWeight: 500,
            whiteSpace: 'normal',
            wordBreak: 'break-word',
          }}
        >
          {question}
        </button>
      ))}
    </div>
  );
}
