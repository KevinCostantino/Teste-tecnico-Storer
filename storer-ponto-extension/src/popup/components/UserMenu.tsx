interface UserMenuProps {
  userName: string
  onLogout: () => Promise<void>
}

export const UserMenu = ({ userName, onLogout }: UserMenuProps): JSX.Element => {
  return (
    <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <strong>{userName}</strong>
      <button onClick={() => void onLogout()}>Sair</button>
    </div>
  )
}
