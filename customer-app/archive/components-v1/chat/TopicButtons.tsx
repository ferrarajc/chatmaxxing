import React, { useState } from 'react';

interface Props {
  topics: string[];
  onSelect: (topic: string) => void;
  disabled: boolean;
}

export function TopicButtons({ topics, onSelect, disabled }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const all = [...topics, 'Something else'];

  const handleClick = (topic: string) => {
    if (disabled || selected) return;
    setSelected(topic);
    onSelect(topic);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>I think you might be here about…</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {all.map(topic => (
          <button
            key={topic}
            onClick={() => handleClick(topic)}
            style={{
              padding: '6px 12px',
              borderRadius: 20,
              border: '1.5px solid #1a56db',
              background: selected === topic ? '#1a56db' : '#fff',
              color: selected === topic ? '#fff' : '#1a56db',
              fontSize: 13, cursor: (disabled || !!selected) ? 'default' : 'pointer',
              opacity: (disabled || (!!selected && selected !== topic)) ? 0.45 : 1,
              transition: 'all .15s',
              fontWeight: 500,
            }}
          >
            {topic}
          </button>
        ))}
      </div>
    </div>
  );
}
