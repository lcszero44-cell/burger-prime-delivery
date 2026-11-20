import { buildWhatsAppUrl } from '../utils/formatters';

interface WhatsAppFloatingButtonProps {
  phone: string;
  message: string;
  storeName: string;
  hasCartBar: boolean;
}

export function WhatsAppFloatingButton({
  phone,
  message,
  storeName,
  hasCartBar,
}: WhatsAppFloatingButtonProps) {
  const href = buildWhatsAppUrl(phone, message);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Falar com ${storeName} pelo WhatsApp`}
      title={`WhatsApp ${storeName}`}
      className={`fixed right-4 sm:right-6 z-30 h-12 w-12 sm:h-13 sm:w-13 rounded-full bg-[#16A34A] hover:bg-[#15803D] text-white shadow-lg shadow-black/20 flex items-center justify-center transition-all duration-200 active:scale-95 ${
        hasCartBar ? 'bottom-24 sm:bottom-24' : 'bottom-5 sm:bottom-6'
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className="w-6 h-6"
        aria-hidden="true"
      >
        <path d="M12.03 2C6.51 2 2.04 6.47 2.04 11.98c0 1.94.55 3.83 1.6 5.45L2 22l4.72-1.56a9.95 9.95 0 0 0 5.31 1.53h.01c5.51 0 9.99-4.47 9.99-9.99C22.03 6.47 17.55 2 12.03 2Zm5.82 14.12c-.25.7-1.45 1.34-2.01 1.42-.51.08-1.17.11-1.88-.12-.44-.14-1-.33-1.72-.64-3.02-1.31-4.99-4.37-5.14-4.57-.15-.2-1.23-1.64-1.23-3.13 0-1.49.78-2.22 1.05-2.52.27-.3.6-.38.8-.38.2 0 .4 0 .58.01.19.01.44-.07.69.53.25.6.86 2.09.94 2.24.08.15.13.33.02.53-.1.2-.15.33-.3.51-.15.18-.32.4-.45.53-.15.15-.31.31-.13.61.18.3.79 1.31 1.7 2.12 1.17 1.04 2.15 1.37 2.45 1.52.3.15.48.13.66-.08.18-.2.76-.89.96-1.19.2-.3.4-.25.68-.15.28.1 1.76.83 2.06.98.3.15.5.23.58.35.07.13.07.73-.18 1.42Z" />
      </svg>
    </a>
  );
}
