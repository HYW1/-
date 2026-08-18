export type PriceBar = {
  open: number;
  close: number;
};

export function calculateConsecutiveUpDays(candles: readonly PriceBar[]) {
  let streak = 0;
  for (let index = candles.length - 1; index > 0; index -= 1) {
    const candle = candles[index];
    const previous = candles[index - 1];
    if (candle.close <= candle.open || candle.close <= previous.close) break;
    streak += 1;
  }
  return streak;
}
