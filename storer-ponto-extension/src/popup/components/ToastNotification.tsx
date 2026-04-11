interface ToastNotificationProps {
  message: string
}

export const ToastNotification = ({ message }: ToastNotificationProps): JSX.Element => {
  return <div className="toast">{message}</div>
}
