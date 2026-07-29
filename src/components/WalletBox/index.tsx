import './WalletBox.css'

type WalletBoxProps = {
  amount: string
  label?: string
}

export const WalletBox = ({ amount, label = 'current wallet' }: WalletBoxProps) => {
  return (
    <div className="wallet-box">
      <span className="wallet-amount">{amount}</span>
      <span className="wallet-label">{label}</span>
    </div>
  )
}
