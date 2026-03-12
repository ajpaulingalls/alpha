export function createInactivityHandler(callbacks: {
  onCheckIn: () => void;
  onTimeout: () => void;
}) {
  let awayCount = 0;
  return (event: { newState: string }) => {
    if (event.newState === "away") {
      awayCount++;
      if (awayCount >= 2) {
        callbacks.onTimeout();
      } else {
        callbacks.onCheckIn();
      }
    } else {
      awayCount = 0;
    }
  };
}
