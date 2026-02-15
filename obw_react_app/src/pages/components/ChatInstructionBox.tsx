import { getMessage } from "@/i18n/messages";

interface ChatInstructionBoxProps {
  hasApprovedGuest: boolean;
  isAfterCheckInTime: boolean;
  onToggleChat: () => void;
}

function getChatInstructionMessage(
  hasApprovedGuest: boolean,
  isAfterCheckInTime: boolean,
): string | string[] {
  if (!hasApprovedGuest) {
    return getMessage("chatIsTheFastestWayToGetHelp");
  }
  if (isAfterCheckInTime) {
    return getMessage("chatInstructionAfterApproved");
  }
  return getMessage("chatInstructionBeforeCheckIn");
}

export function ChatInstructionBox({
  hasApprovedGuest,
  isAfterCheckInTime,
  onToggleChat,
}: Readonly<ChatInstructionBoxProps>) {
  return (
    <button
      type="button"
      className="mt-4 rounded-xl border border-teal-200 bg-gradient-to-r from-teal-50 to-cyan-50 shadow-md p-6 cursor-pointer hover:from-teal-100 hover:to-cyan-100 transition-colors w-full text-left"
      onClick={onToggleChat}
    >
      <div className="flex items-center gap-3">
        <img src="/icons8-bot-64.png" alt="" className="w-8 h-8 shrink-0" />
        <p className="text-lg font-semibold text-teal-900 whitespace-pre-line">
          {getChatInstructionMessage(hasApprovedGuest, isAfterCheckInTime)}
        </p>
      </div>
    </button>
  );
}
