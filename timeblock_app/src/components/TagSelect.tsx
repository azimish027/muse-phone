import type { CSSProperties } from 'react';
import type { Tag } from '../types';

interface TagSelectProps {
  tags: Tag[];
  value: string;
  onChange: (tagId: string) => void;
  testId?: string;
}

/** 标签选择器：无标签 + 一级标签 + 二级标签，色点 + 名称，选中带描边。 */
export function TagSelect({ tags, value, onChange, testId }: TagSelectProps) {
  const parents = tags.filter((t) => !t.parentId);
  const children = tags.filter((t) => t.parentId);
  const items: Array<{ id: string; name: string; color: string; indent: boolean }> = [
    { id: '', name: '无标签', color: '#9CA3AF', indent: false },
    ...parents.map((t) => ({ id: t.id, name: t.name, color: t.color, indent: false })),
    ...children.map((t) => ({ id: t.id, name: t.name, color: t.color, indent: true })),
  ];
  return (
    <div className="tag-select" data-testid={testId}>
      {items.map((item) => {
        const selected = value === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={`tag-option ${selected ? 'tag-option-selected' : ''} ${item.indent ? 'tag-option-indent' : ''}`}
            style={selected ? ({ '--tag-opt-color': item.color } as CSSProperties) : undefined}
            onClick={() => onChange(item.id)}
            data-testid={`${testId}-option-${item.id || 'none'}`}
          >
            <span className="tag-dot" style={{ background: item.color }} />
            <span className="tag-option-name">{item.name}</span>
            {selected && <span className="tag-option-check">✓</span>}
          </button>
        );
      })}
    </div>
  );
}