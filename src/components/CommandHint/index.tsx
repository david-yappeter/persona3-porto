import './CommandHint.css'

type CommandHintProps = {
  title: string
  command?: string
}

export const CommandHint = ({ title, command = 'Command' }: CommandHintProps) => {
  return (
    <div className="command-hint">
      <span className="command-hint-title">{title}</span>
      <span className="command-hint-sub">{command}</span>
    </div>
  )
}
