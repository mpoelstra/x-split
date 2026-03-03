const round2 = (value: number): number => Math.round(value * 100) / 100;

export const DEFAULT_BILL_PARTICIPANTS = 2;

export const calculateNetToPayer = (
  amount: number,
  participantCount = DEFAULT_BILL_PARTICIPANTS
): number | undefined => {
  if (!Number.isFinite(amount) || amount <= 0) {
    return undefined;
  }

  if (!Number.isInteger(participantCount) || participantCount <= 1) {
    return undefined;
  }

  return round2((amount * (participantCount - 1)) / participantCount);
};
