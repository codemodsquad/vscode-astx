import * as React from 'react'

type Props = {
  colors: { value: string }[]
  onChange?: (colors: { value: string }[]) => unknown
}

export default function ColorList({
  colors,
  onChange,
}: Props): React.ReactNode {
  return (
    <ul className="color-list">
      {colors.map((color, index) => (
        <li key={index} className="color-entry">
          <div
            className="color-preview"
            style={{ backgroundColor: `#${color.value}` }}
          />
          <input
            className="color-input"
            type="text"
            value={color.value}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const { value } = e.currentTarget
              const newColors = [...colors]
              if (!value) {
                // Treat empty value as delete
                newColors.splice(colors.indexOf(color), 1)
              } else {
                newColors[index] = { value }
              }
              onChange?.(newColors)
            }}
          />
        </li>
      ))}
    </ul>
  )
}
